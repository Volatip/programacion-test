import { CircleHelp } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { isAdminRole } from "../../lib/userRoles";
import { contextualHelpApi, type ContextualHelpPage } from "../../lib/contextualHelp";
import { Modal } from "../ui/Modal";

interface ContextualHelpButtonProps {
  slug: string;
  className?: string;
}

export function ContextualHelpButton({ slug, className = "" }: ContextualHelpButtonProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [help, setHelp] = useState<ContextualHelpPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || help?.slug === slug) {
      return;
    }

    let isMounted = true;

    const loadHelp = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await contextualHelpApi.getBySlug(slug);
        if (isMounted) {
          setHelp(response);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la ayuda contextual.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadHelp();

    return () => {
      isMounted = false;
    };
  }, [help?.slug, isOpen, slug]);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir ayuda contextual"
        onClick={() => setIsOpen(true)}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-primary hover:text-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-300 ${className}`.trim()}
      >
        <CircleHelp className="h-5 w-5" />
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={help ? `Ayuda: ${help.page_name}` : "Ayuda contextual"} className="max-w-3xl">
        <div className="space-y-6 p-6 text-sm text-gray-700 dark:text-gray-200">
          {loading && <p>Cargando ayuda contextual...</p>}

          {!loading && error && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              <p>{error}</p>
              {isAdminRole(user?.role) && (
                <Link to={`/admin/ayudas-contextuales?slug=${encodeURIComponent(slug)}`} className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline dark:text-blue-300">
                  Crear o editar esta ayuda
                </Link>
              )}
            </div>
          )}

          {!loading && !error && help && (
            <>
              {help.description && <p className="text-base leading-7 text-gray-600 dark:text-gray-300">{help.description}</p>}

              <div className="space-y-4">
                {help.sections.map((section) => (
                  <section key={section.id} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{section.position}. {section.title}</h3>
                    <p className="mt-2 whitespace-pre-line leading-7 text-gray-600 dark:text-gray-300">{section.content}</p>
                  </section>
                ))}
              </div>

              {isAdminRole(user?.role) && (
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/20">
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-200">¿Necesitas ajustar este contenido?</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      {help.updated_by_name ? `Última edición: ${help.updated_by_name}` : "Aún no registra editor administrador."}
                    </p>
                  </div>
                  <Link to={`/admin/ayudas-contextuales?slug=${encodeURIComponent(slug)}`} className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                    Gestionar ayuda
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
