import React, { useEffect, useMemo, useState } from 'react';
import { FilePenLine } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { appConfigApi, parseErrorDetail, parseJsonResponse, type AppConfigResponse } from '../../lib/api';
import {
  buildPageHeaderConfigDescription,
  buildPageHeaderConfigKey,
  getPageHeaderValidationError,
  parsePageHeaderConfig,
  serializePageHeaderConfig,
} from '../../lib/pageHeaderConfig';
import { Modal } from './Modal';

interface PageHeaderProps {
  title: string;
  pageSlug?: string;
  subtitle?: React.ReactNode;
  defaultSubtitle?: string;
  subtitleRenderer?: (subtitle: string) => React.ReactNode;
  normalizePersistedSubtitle?: (subtitle: string) => string;
  allowEmptySubtitle?: boolean;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  pageSlug,
  subtitle,
  defaultSubtitle,
  subtitleRenderer,
  normalizePersistedSubtitle,
  allowEmptySubtitle = false,
  children,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [resolvedTitle, setResolvedTitle] = useState(title);
  const [resolvedSubtitle, setResolvedSubtitle] = useState(defaultSubtitle ?? (typeof subtitle === 'string' ? subtitle : ''));
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftSubtitle, setDraftSubtitle] = useState(defaultSubtitle ?? (typeof subtitle === 'string' ? subtitle : ''));
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const subtitleContent = typeof subtitle === 'string' ? null : subtitle;
  const renderedSubtitle = subtitleRenderer ? subtitleRenderer(resolvedSubtitle) : resolvedSubtitle ? <p>{resolvedSubtitle}</p> : null;
  const hasVisibleSubtitle = renderedSubtitle !== null && renderedSubtitle !== undefined && renderedSubtitle !== false;

  const defaults = useMemo(
    () => ({
      title: title.trim(),
      subtitle: (defaultSubtitle ?? (typeof subtitle === 'string' ? subtitle : '')).trim(),
    }),
    [defaultSubtitle, subtitle, title],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      setResolvedTitle(defaults.title);
      setResolvedSubtitle(defaults.subtitle);
      setDraftTitle(defaults.title);
      setDraftSubtitle(defaults.subtitle);

      if (!pageSlug) {
        return;
      }

      try {
        const response = await appConfigApi.read(buildPageHeaderConfigKey(pageSlug));

        if (response.status === 404) {
          return;
        }

        if (!response.ok) {
          throw new Error(await parseErrorDetail(response, 'No se pudo cargar el encabezado de la página.'));
        }

        const payload = await parseJsonResponse<AppConfigResponse>(response);
        const nextConfig = parsePageHeaderConfig(payload.value, defaults);
        const normalizedSubtitle = normalizePersistedSubtitle ? normalizePersistedSubtitle(nextConfig.subtitle) : nextConfig.subtitle;

        if (!cancelled) {
          setResolvedTitle(nextConfig.title);
          setResolvedSubtitle(normalizedSubtitle);
          setDraftTitle(nextConfig.title);
          setDraftSubtitle(normalizedSubtitle);
        }
      } catch {
        if (!cancelled) {
          setResolvedTitle(defaults.title);
          setResolvedSubtitle(defaults.subtitle);
          setDraftTitle(defaults.title);
          setDraftSubtitle(defaults.subtitle);
        }
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, [defaults, normalizePersistedSubtitle, pageSlug]);

  function handleOpenEditor() {
    setDraftTitle(resolvedTitle);
    setDraftSubtitle(resolvedSubtitle);
    setError('');
    setIsEditOpen(true);
  }

  function handleCloseEditor() {
    if (isSaving) {
      return;
    }

    setIsEditOpen(false);
    setError('');
  }

  async function handleSave() {
    if (!pageSlug) {
      return;
    }

    const validationError = getPageHeaderValidationError(
      {
        title: draftTitle,
        subtitle: draftSubtitle,
      },
      { allowEmptySubtitle },
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    const nextConfig = parsePageHeaderConfig(
      serializePageHeaderConfig({
        version: 1,
        title: draftTitle,
        subtitle: draftSubtitle,
      }),
      defaults,
    );

    setIsSaving(true);
    setError('');

    try {
      const response = await appConfigApi.upsert({
        key: buildPageHeaderConfigKey(pageSlug),
        value: serializePageHeaderConfig(nextConfig),
        description: buildPageHeaderConfigDescription(pageSlug),
      });

      if (!response.ok) {
        throw new Error(await parseErrorDetail(response, 'No se pudo guardar el encabezado de la página.'));
      }

      setResolvedTitle(nextConfig.title);
      setResolvedSubtitle(nextConfig.subtitle);
      setIsEditOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el encabezado de la página.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
    <div className="mb-6 flex flex-col justify-between gap-3 transition-colors md:flex-row md:items-center xl:gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white xl:text-3xl">{resolvedTitle}</h1>
        {(hasVisibleSubtitle || subtitleContent) && (
          <div className="mt-1 space-y-2 text-base text-gray-500 dark:text-gray-400 xl:text-lg">
            {renderedSubtitle}
            {subtitleContent ? <div>{subtitleContent}</div> : null}
          </div>
        )}
      </div>
      {(children || (pageSlug && isAdmin)) && (
        <div className="flex flex-wrap items-center gap-2 xl:gap-3">
          {pageSlug && isAdmin ? (
            <button
              type="button"
              onClick={handleOpenEditor}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <FilePenLine className="h-4 w-4" />
              Editar encabezado
            </button>
          ) : null}
          {children}
        </div>
      )}
    </div>
    {pageSlug && isAdmin ? (
      <Modal isOpen={isEditOpen} onClose={handleCloseEditor} title="Editar encabezado" className="max-w-2xl">
        <div className="space-y-5 p-6">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Título</span>
            <input
              type="text"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              maxLength={120}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Subtítulo</span>
            <textarea
              value={draftSubtitle}
              onChange={(event) => setDraftSubtitle(event.target.value)}
              maxLength={240}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>

          {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCloseEditor}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? 'Guardando...' : 'Guardar encabezado'}
            </button>
          </div>
        </div>
      </Modal>
    ) : null}
    </>
  );
};
