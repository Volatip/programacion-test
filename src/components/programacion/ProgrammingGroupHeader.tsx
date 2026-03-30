import { ArrowLeft, UserPlus } from "lucide-react";

interface ProgrammingGroupHeaderProps {
  groupName: string;
  officialsCount: number;
  isReadOnly: boolean;
  canAssignOfficials: boolean;
  onBack: () => void;
  onAddOfficial: () => void;
}

export function ProgrammingGroupHeader({
  groupName,
  officialsCount,
  isReadOnly,
  canAssignOfficials,
  onBack,
  onAddOfficial,
}: ProgrammingGroupHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onBack}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
      >
        <ArrowLeft className="w-6 h-6 text-gray-500 dark:text-gray-400" />
      </button>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          {groupName}
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 mt-1">
          {officialsCount} funcionarios asignados
        </p>
      </div>
      <div className="flex-1" />
      {!isReadOnly && canAssignOfficials && (
        <button
          onClick={onAddOfficial}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Añadir Funcionario
        </button>
      )}
    </div>
  );
}
