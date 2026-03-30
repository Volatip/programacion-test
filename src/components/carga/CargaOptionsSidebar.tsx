interface UploadOption {
  id: string;
  title: string;
  icon: React.ElementType;
}

interface CargaOptionsSidebarProps {
  options: UploadOption[];
  selectedType: string;
  onSelect: (id: string) => void;
}

export function CargaOptionsSidebar({
  options,
  selectedType,
  onSelect,
}: CargaOptionsSidebarProps) {
  return (
    <div className="lg:col-span-1 space-y-2">
      {options.map((option) => {
        const Icon = option.icon;

        return (
          <button
            key={option.id}
            onClick={() => onSelect(option.id)}
            className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
              selectedType === option.id
                ? "bg-primary text-white shadow-md"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700"
            }`}
          >
            <Icon className={`w-5 h-5 ${selectedType === option.id ? "text-white" : "text-gray-400 dark:text-gray-500"}`} />
            <span className="font-medium">{option.title}</span>
          </button>
        );
      })}
    </div>
  );
}
