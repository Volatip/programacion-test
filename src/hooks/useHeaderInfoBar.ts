import { useCallback, useEffect, useState } from "react";
import { buildApiUrl, fetchWithAuth } from "../lib/api";
import {
  buildHeaderInfoBarPlainText,
  cloneHeaderInfoBarConfig,
  createDefaultHeaderInfoBarConfig,
  getHeaderInfoBarValidationError,
  HEADER_INFO_CONFIG_KEY,
  HEADER_INFO_DESCRIPTION,
  type HeaderInfoBarConfig,
  parseHeaderInfoBarConfig,
  serializeHeaderInfoBarConfig,
} from "../lib/headerInfoBar";

const HEADER_INFO_STORAGE_KEY = "headerInfoText";
const HEADER_VISIBILITY_STORAGE_KEY = "headerInfoVisible";

interface HeaderInfoBarMessage {
  type?: string;
  payload?: {
    text?: string;
    config?: HeaderInfoBarConfig;
  };
}

interface UseHeaderInfoBarParams {
  lastMessage: string | null;
  onBroadcast: (message: string) => void;
  updatedBy?: string;
}

export function useHeaderInfoBar({ lastMessage, onBroadcast, updatedBy }: UseHeaderInfoBarParams) {
  const [infoConfig, setInfoConfig] = useState<HeaderInfoBarConfig>(createDefaultHeaderInfoBarConfig());
  const [isInfoVisible, setIsInfoVisible] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tempInfoConfig, setTempInfoConfig] = useState<HeaderInfoBarConfig>(createDefaultHeaderInfoBarConfig());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!lastMessage) {
      return;
    }

    try {
      const data: HeaderInfoBarMessage = JSON.parse(lastMessage);
      if (data.type === "INFO_BAR_UPDATE") {
        const nextConfig = data.payload?.config
          ? cloneHeaderInfoBarConfig(data.payload.config)
          : parseHeaderInfoBarConfig(data.payload?.text);

        setInfoConfig(nextConfig);
        localStorage.setItem(HEADER_INFO_STORAGE_KEY, serializeHeaderInfoBarConfig(nextConfig));
      }
    } catch (parseError) {
      console.error("Error parsing WS message", parseError);
    }
  }, [lastMessage]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetchWithAuth(buildApiUrl("/config/configs/header_info_text"));
        if (response.ok) {
          const data = await response.json();
          const nextConfig = parseHeaderInfoBarConfig(data.value);
          setInfoConfig(nextConfig);
          localStorage.setItem(HEADER_INFO_STORAGE_KEY, serializeHeaderInfoBarConfig(nextConfig));
          return;
        }

        if (response.status === 404) {
          const savedText = localStorage.getItem(HEADER_INFO_STORAGE_KEY);
          if (savedText) {
            setInfoConfig(parseHeaderInfoBarConfig(savedText));
          }
        }
      } catch (fetchError) {
        console.error("Failed to fetch info text config", fetchError);
        const savedText = localStorage.getItem(HEADER_INFO_STORAGE_KEY);
        if (savedText) {
          setInfoConfig(parseHeaderInfoBarConfig(savedText));
        }
      }
    };

    fetchConfig();

    const savedVisibility = localStorage.getItem(HEADER_VISIBILITY_STORAGE_KEY);
    if (savedVisibility !== null) {
      setIsInfoVisible(savedVisibility === "true");
    }
  }, []);

  const openEditModal = useCallback(() => {
    setTempInfoConfig(cloneHeaderInfoBarConfig(infoConfig));
    setError("");
    setIsEditModalOpen(true);
  }, [infoConfig]);

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setError("");
  }, []);

  const toggleInfoVisibility = useCallback(() => {
    setIsInfoVisible((currentValue) => {
      const nextValue = !currentValue;
      localStorage.setItem(HEADER_VISIBILITY_STORAGE_KEY, String(nextValue));
      return nextValue;
    });
  }, []);

  const handleSaveInfo = useCallback(async () => {
    const validationError = getHeaderInfoBarValidationError(tempInfoConfig);
    if (validationError) {
      setError(validationError);
      return;
    }

    const nextConfig = cloneHeaderInfoBarConfig(tempInfoConfig);
    const serializedValue = serializeHeaderInfoBarConfig(nextConfig);

    try {
      await fetchWithAuth(buildApiUrl("/config/configs"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: HEADER_INFO_CONFIG_KEY,
          value: serializedValue,
          description: HEADER_INFO_DESCRIPTION,
        }),
      });
    } catch (saveError) {
      console.error("Failed to save config to DB", saveError);
    }

    setInfoConfig(nextConfig);
    localStorage.setItem(HEADER_INFO_STORAGE_KEY, serializedValue);
    setIsEditModalOpen(false);
    setError("");

    setIsInfoVisible((currentValue) => {
      if (!currentValue) {
        localStorage.setItem(HEADER_VISIBILITY_STORAGE_KEY, "true");
        return true;
      }
      return currentValue;
    });

    onBroadcast(JSON.stringify({
      type: "INFO_BAR_UPDATE",
      payload: {
        text: buildHeaderInfoBarPlainText(nextConfig),
        config: nextConfig,
        updatedBy,
      },
    }));
  }, [onBroadcast, tempInfoConfig, updatedBy]);

  return {
    closeEditModal,
    error,
    handleSaveInfo,
    infoConfig,
    isEditModalOpen,
    isInfoVisible,
    openEditModal,
    setError,
    setTempInfoConfig,
    tempInfoConfig,
    toggleInfoVisibility,
  };
}
