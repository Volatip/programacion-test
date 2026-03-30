export function ProgrammingActivitiesEmptyState() {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
      <p className="text-gray-500 dark:text-gray-400 italic text-sm font-medium">
        La programación de actividades no es requerida para este funcionario.
      </p>
      <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
        (Ley 15076 con contrato único, sin liberación de guardia)
      </p>
    </div>
  );
}
