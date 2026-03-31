import { useCallback, useEffect, useState } from "react";
import { buildApiUrl, fetchWithAuth } from "../lib/api";

const HEADER_INFO_STORAGE_KEY = "headerInfoText";
const HEADER_VISIBILITY_STORAGE_KEY = "headerInfoVisible";
const DEFAULT_INFO_TEXT = "¡Bienvenido al sistema de gestión!";

interface HeaderInfoBarMessage {
  type?: string;
  payload?: {
    text?: string;
  };
}

interface UseHeaderInfoBarParams {
  lastMessage: string | null;
  onBroadcast: (message: string) => void;
  updatedBy?: string;
}

export function useHeaderInfoBar({ lastMessage, onBroadcast, updatedBy }: UseHeaderInfoBarParams) {
  const [infoText, setInfoText] = useState(DEFAULT_INFO_TEXT);
  const [isInfoVisible, setIsInfoVisible] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tempInfoText, setTempInfoText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!lastMessage) {
      return;
    }

    try {
      const data: HeaderInfoBarMessage = JSON.parse(lastMessage);
      if (data.type === "INFO_BAR_UPDATE" && typeof data.payload?.text === "string") {
        setInfoText(data.payload.text);
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
          setInfoText(data.value);
          localStorage.setItem(HEADER_INFO_STORAGE_KEY, data.value);
          return;
        }

        if (response.status === 404) {
          const savedText = localStorage.getItem(HEADER_INFO_STORAGE_KEY);
          if (savedText) {
            setInfoText(savedText);
          }
        }
      } catch (fetchError) {
        console.error("Failed to fetch info text config", fetchError);
        const savedText = localStorage.getItem(HEADER_INFO_STORAGE_KEY);
        if (savedText) {
          setInfoText(savedText);
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
    setTempInfoText(infoText);
    setError("");
    setIsEditModalOpen(true);
  }, [infoText]);

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
    if (tempInfoText.length > 200) {
      setError("El texto no puede exceder los 200 caracteres");
      return;
    }

    try {
      await fetchWithAuth(buildApiUrl("/config/configs"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "header_info_text",
          value: tempInfoText,
          description: "Texto de la barra informativa del header"
        }),
      });
    } catch (saveError) {
      console.error("Failed to save config to DB", saveError);
    }

    setInfoText(tempInfoText);
    localStorage.setItem(HEADER_INFO_STORAGE_KEY, tempInfoText);
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
        text: tempInfoText,
        updatedBy,
      }
    }));
  }, [onBroadcast, tempInfoText, updatedBy]);

  return {
    closeEditModal,
    error,
    handleSaveInfo,
    infoText,
    isEditModalOpen,
    isInfoVisible,
    openEditModal,
    setError,
    setTempInfoText,
    tempInfoText,
    toggleInfoVisibility,
  };
}
