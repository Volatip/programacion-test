import React, { useState } from 'react';
import { usePeriods } from '../context/PeriodsContext';
import { useAuth } from '../context/AuthContext';
import { PeriodsModals } from '../components/periodos/PeriodsModals';
import { PageHeader } from '../components/ui/PageHeader';
import { CheckCircle, Trash, Plus, Calendar, Pencil, EyeOff, History, CopyPlus } from 'lucide-react';
import { Period } from '../context/PeriodsContext';
import { buildApiUrl, fetchWithAuth, parseErrorDetail } from '../lib/api';
import { ContextualHelpButton } from '../components/contextual-help/ContextualHelpButton';

type JsonBody = Record<string, unknown>;

const api = {
  post: (url: string, body?: JsonBody) => fetchWithAuth(buildApiUrl(url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  }),
  put: (url: string, body?: JsonBody) => fetchWithAuth(buildApiUrl(url), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  }),
  delete: (url: string) => fetchWithAuth(buildApiUrl(url), { method: 'DELETE' })
};

type DuplicateState = {
  isOpen: boolean;
  sourcePeriod: Period | null;
  destinationPeriodId: string;
  isSubmitting: boolean;
};

export const Periodos: React.FC = () => {
  const { periods, refreshPeriods } = usePeriods();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    start_date: string;
    end_date: string;
    status: 'ANTIGUO' | 'ACTIVO' | 'OCULTO';
    is_active: boolean;
  }>({
    name: '',
    start_date: '',
    end_date: '',
    status: 'ANTIGUO',
    is_active: false
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  const [deleteState, setDeleteState] = useState<{
    isOpen: boolean;
    step: 1 | 2;
    periodId: number | null;
  }>({
    isOpen: false,
    step: 1,
    periodId: null
  });

  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [duplicateState, setDuplicateState] = useState<DuplicateState>({
    isOpen: false,
    sourcePeriod: null,
    destinationPeriodId: '',
    isSubmitting: false
  });

  if (user?.role !== 'admin') {
    return <div className="p-6 text-center text-gray-500">Acceso denegado</div>;
  }

  const handleEdit = (period: Period) => {
    setEditingId(period.id);
    setFormData({
      name: period.name,
      start_date: period.start_date.split('T')[0],
      end_date: period.end_date.split('T')[0],
      status: period.status || (period.is_active ? 'ACTIVO' : 'ANTIGUO'),
      is_active: period.is_active
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setStatusConfirmOpen(false);
    setEditingId(null);
    setFormData({ name: '', start_date: '', end_date: '', status: 'ANTIGUO', is_active: false });
  };

  const executeSubmit = async () => {
    try {
      const payload = {
        ...formData,
        is_active: formData.status === 'ACTIVO'
      };

      if (editingId) {
        await api.put(`/periods/${editingId}`, payload);
      } else {
        await api.post('/periods', payload);
      }
      await refreshPeriods();
      handleCloseModal();
    } catch (error) {
      console.error(error);
      alert("Error al guardar período");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.status === 'ANTIGUO') {
      setStatusConfirmOpen(true);
      return;
    }

    await executeSubmit();
  };

  const handleActivate = async (periodId: number) => {
    if (confirm("¿Activar este período? Se desactivarán los otros.")) {
      try {
        await api.post(`/periods/${periodId}/activate`);
        await refreshPeriods({ forceActiveSelection: true });
      } catch (error) {
        console.error(error);
      }
    }
  };

  const initiateDelete = (periodId: number) => {
    setDeleteState({
      isOpen: true,
      step: 1,
      periodId: periodId
    });
  };

  const confirmDeleteStep1 = () => {
    setDeleteState(prev => ({ ...prev, step: 2 }));
  };

  const finalizeDelete = async () => {
    if (!deleteState.periodId) return;

    try {
      await api.delete(`/periods/${deleteState.periodId}`);
      await refreshPeriods();
      setDeleteState({ isOpen: false, step: 1, periodId: null });
    } catch (error) {
      console.error(error);
      alert("No se puede eliminar un período con datos asociados");
      setDeleteState({ isOpen: false, step: 1, periodId: null });
    }
  };

  const cancelDelete = () => {
    setDeleteState({ isOpen: false, step: 1, periodId: null });
  };

  const openDuplicateModal = (period: Period) => {
    const defaultTarget = periods.find((candidate) => candidate.id !== period.id);
    setDuplicateState({
      isOpen: true,
      sourcePeriod: period,
      destinationPeriodId: defaultTarget ? String(defaultTarget.id) : '',
      isSubmitting: false
    });
  };

  const closeDuplicateModal = () => {
    setDuplicateState({
      isOpen: false,
      sourcePeriod: null,
      destinationPeriodId: '',
      isSubmitting: false
    });
  };

  const submitDuplicate = async () => {
    if (!duplicateState.sourcePeriod || !duplicateState.destinationPeriodId) {
      alert('Selecciona un período destino válido.');
      return;
    }

    setDuplicateState((prev) => ({ ...prev, isSubmitting: true }));

    try {
      const response = await api.post(`/periods/${duplicateState.sourcePeriod.id}/duplicate-base`, {
        destination_period_id: Number(duplicateState.destinationPeriodId)
      });

      if (!response.ok) {
        throw new Error(await parseErrorDetail(response, 'No fue posible duplicar la base del período.'));
      }

      await refreshPeriods();
      closeDuplicateModal();
      alert('Base del período duplicada correctamente.');
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'No fue posible duplicar la base del período.');
      setDuplicateState((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const getStatusBadge = (status: string, isActive: boolean) => {
    const effectiveStatus = status || (isActive ? 'ACTIVO' : 'ANTIGUO');

    switch (effectiveStatus) {
      case 'ACTIVO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
            <CheckCircle size={12} />
            Activo
          </span>
        );
      case 'OCULTO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            <EyeOff size={12} />
            Oculto
          </span>
        );
      case 'ANTIGUO':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
            <History size={12} />
            Antiguo
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Períodos de Programación"
        subtitle="Gestiona los períodos académicos y sus estados"
      >
        <ContextualHelpButton slug="periodos" />
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', start_date: '', end_date: '', status: 'ANTIGUO', is_active: false });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          <Plus size={20} />
          Nuevo Período
        </button>
      </PageHeader>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-4 font-semibold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-4 font-semibold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wider">Inicio</th>
                <th className="px-6 py-4 font-semibold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wider">Fin</th>
                <th className="px-6 py-4 font-semibold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 font-semibold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {periods.map((period) => (
                <tr key={period.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 dark:text-white">{period.name}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400 dark:text-gray-500" />
                      {new Date(period.start_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400 dark:text-gray-500" />
                      {new Date(period.end_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(period.status, period.is_active)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleEdit(period)}
                        className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 p-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                        title="Editar período"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => openDuplicateModal(period)}
                        disabled={periods.length < 2}
                        className="text-gray-400 hover:text-indigo-600 dark:text-gray-500 dark:hover:text-indigo-400 p-1.5 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Duplicar base a otro período"
                      >
                        <CopyPlus size={18} />
                      </button>
                      {period.status === 'OCULTO' && (
                        <button
                          onClick={() => handleActivate(period.id)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium hover:underline decoration-blue-600/30 dark:decoration-blue-400/30"
                          title="Activar período"
                        >
                          Activar
                        </button>
                      )}
                      <button
                        onClick={() => initiateDelete(period.id)}
                        className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                        title="Eliminar período"
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {periods.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No hay períodos registrados. Crea uno nuevo para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PeriodsModals
        isModalOpen={isModalOpen}
        handleCloseModal={handleCloseModal}
        editingId={editingId}
        formData={formData}
        setFormData={setFormData}
        handleSubmit={handleSubmit}
        statusConfirmOpen={statusConfirmOpen}
        setStatusConfirmOpen={setStatusConfirmOpen}
        executeSubmit={executeSubmit}
        deleteState={deleteState}
        cancelDelete={cancelDelete}
        confirmDeleteStep1={confirmDeleteStep1}
        finalizeDelete={finalizeDelete}
        periods={periods}
        duplicateState={duplicateState}
        setDuplicateState={setDuplicateState}
        closeDuplicateModal={closeDuplicateModal}
        submitDuplicate={submitDuplicate}
      />
    </div>
  );
};
