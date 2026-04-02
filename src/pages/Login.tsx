import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Github, Sun, Moon } from 'lucide-react';
import { formatRut, validateRut } from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { useTheme } from '../hooks/useTheme';
import { isSupervisorRole } from '../lib/userRoles';
import { getStoredSession } from '../lib/api';

const LOGO_URL = `${import.meta.env.BASE_URL}logo.png`;
const BACKGROUND_URL = `${import.meta.env.BASE_URL}fondo.jpg`;

export function Login() {
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRut(formatRut(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateRut(rut)) {
      if (rut !== '2.222.222-2') {
        setError('RUT inválido. Verifique el formato y dígito verificador.');
        return;
      }
    }

    setIsLoading(true);

    try {
      await login(rut, password);
      const storedUser = JSON.parse(getStoredSession().user || 'null') as { role?: string } | null;
      navigate('/');
    } catch (err) {
      setError('Credenciales inválidas. Por favor intente nuevamente.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex">
      <div className="w-full lg:w-[40%] flex flex-col justify-center items-center p-8 bg-white dark:bg-slate-900 text-slate-900 dark:text-white relative transition-colors duration-200">
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-white/10"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="w-full max-w-sm space-y-8 z-10">
          <div className="text-center mb-10">
            <div className="flex justify-center mb-6">
              <img
                src={LOGO_URL}
                alt="Logo Hospital"
                className="h-24 w-auto object-contain drop-shadow-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
              ¡Qué bueno verte!
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ingresa con tu RUT y contraseña para continuar.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2"
            >
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div>
                <label htmlFor="rut" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  RUT
                </label>
                <div className="relative">
                  <input
                    id="rut"
                    name="rut"
                    type="text"
                    required
                    autoComplete="username"
                    inputMode="numeric"
                    className="block w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors text-sm"
                    placeholder="12.345.678-5"
                    value={rut}
                    onChange={handleRutChange}
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Usa el RUT con puntos y dígito verificador.
                </p>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    className="block w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors text-sm pr-10"
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-full text-white bg-secondary hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl mt-8"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Ingresando...</span>
                </div>
              ) : (
                "Iniciar sesión"
              )}
            </button>

            <div className="flex items-center justify-center mt-4">
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-sm text-gray-400 hover:text-slate-700 dark:hover:text-white transition-colors focus:outline-none hover:underline"
              >
                ¿Olvidó su contraseña?
              </button>
            </div>
          </form>

          <div className="p-6 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-center text-gray-400 dark:text-gray-500">Plataforma de Programación 2026</p>
            <a
              href="https://github.com/Volatip"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 mt-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <Github className="w-4 h-4" />
              <span className="text-xs">Pedro Castro Cariaga</span>
            </a>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-[60%] bg-white relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={BACKGROUND_URL}
            alt="Fondo Hospital"
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/60 to-transparent mix-blend-multiply"></div>
        </div>
      </div>

      <Modal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        title="Recuperar Contraseña"
        className="max-w-md"
      >
        <div className="p-6 text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">¿Olvidaste tu contraseña?</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Para restablecer tu acceso, por favor contacta al administrador enviando una solicitud a:
          </p>

          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
            <p className="font-mono text-sm font-medium text-primary break-all select-all">
              pedro.castro.c@redsalud.gob.cl
            </p>
          </div>

          <button
            onClick={() => setIsForgotPasswordOpen(false)}
            className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:text-sm"
          >
            Entendido
          </button>
        </div>
      </Modal>
    </div>
  );
}
