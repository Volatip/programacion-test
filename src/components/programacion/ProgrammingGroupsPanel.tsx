import { BarChart, ChevronRight, Edit2, MoreVertical, Plus, Trash2, UserPlus } from "lucide-react";
import type React from "react";
import { useNavigate } from "react-router-dom";
import type { Group } from "../../context/OfficialsContextDefs";
import { isAutomaticProgrammingGroup } from "../../lib/programmingGroups";

interface ProgrammingGroupsPanelProps {
  groups: Group[];
  isReadOnly: boolean;
  openMenuGroupId: number | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onCreateGroup: (event: React.MouseEvent) => void;
  onToggleMenu: (event: React.MouseEvent, groupId: number) => void;
  onEditGroup: (event: React.MouseEvent, group: Group) => void;
  onDeleteGroup: (event: React.MouseEvent, group: Group) => void;
  canAssignOfficials: boolean;
  onAddOfficialToGroup: (group: Group) => void;
}

export function ProgrammingGroupsPanel({
  groups,
  isReadOnly,
  openMenuGroupId,
  menuRef,
  onCreateGroup,
  onToggleMenu,
  onEditGroup,
  onDeleteGroup,
  canAssignOfficials,
  onAddOfficialToGroup,
}: ProgrammingGroupsPanelProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-visible hover:shadow-md transition-shadow duration-300">
      <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-2xl">
            <BarChart className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Grupos Propios</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Administra tus equipos de trabajo</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm font-bold px-3 py-1 rounded-full border border-green-100 dark:border-green-800">
            {groups.length} grupos
          </span>
          <button
            onClick={onCreateGroup}
            disabled={isReadOnly}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all shadow-sm transform hover:scale-105 active:scale-95 ${
              isReadOnly
                ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700 hover:shadow-green-200 dark:hover:shadow-none"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo Grupo</span>
          </button>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4" ref={menuRef}>
        {groups.map((group) => (
          
          <div
            key={group.id}
            className="relative group bg-gray-50 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700 rounded-2xl border border-transparent hover:border-green-100 dark:hover:border-green-700 hover:shadow-lg transition-all duration-300"
          >
            <div
              onClick={() => navigate(`/programacion/grupo/${group.id}`)}
              className="p-5 cursor-pointer h-full flex flex-col justify-between"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-gray-800 dark:text-gray-100 text-lg line-clamp-1 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
                    {group.name}
                  </span>
                  {isAutomaticProgrammingGroup(group.id) && (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 whitespace-nowrap">
                      Automático
                    </span>
                  )}
                </div>
                {!isReadOnly && !isAutomaticProgrammingGroup(group.id) && (
                  <button
                    onClick={(event) => onToggleMenu(event, group.id)}
                    className="p-1.5 -mr-2 -mt-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-end justify-between mt-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1 rounded-lg border border-gray-100 dark:border-gray-600 shadow-sm group-hover:border-green-100 dark:group-hover:border-green-700 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                  {group.count} miembros
                </span>

                <div className="flex gap-2">
                  {!isReadOnly && canAssignOfficials && !isAutomaticProgrammingGroup(group.id) && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onAddOfficialToGroup(group);
                      }}
                      className="p-2 bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-xl text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 border border-gray-100 dark:border-gray-700 hover:border-green-100 dark:hover:border-green-700 shadow-sm transition-all opacity-0 group-hover:opacity-100 transform hover:scale-110"
                      title="Añadir funcionario"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  )}
                  <div className="p-2 bg-white dark:bg-gray-800 rounded-xl text-gray-300 dark:text-gray-600 border border-gray-100 dark:border-gray-700 shadow-sm group-hover:text-green-400 dark:group-hover:text-green-400 group-hover:border-green-100 dark:group-hover:border-green-700 transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {openMenuGroupId === group.id && !isReadOnly && !isAutomaticProgrammingGroup(group.id) && (
              <div className="absolute right-2 top-10 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-30 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <button
                  onClick={(event) => onEditGroup(event, group)}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 font-medium"
                >
                  <Edit2 className="w-4 h-4 text-gray-400" />
                  Editar
                </button>
                <button
                  onClick={(event) => onDeleteGroup(event, group)}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              </div>
            )}
          </div>
        ))}

        {groups.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400 dark:text-gray-500 bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <BarChart className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No tienes grupos creados</p>
            <button
              onClick={onCreateGroup}
              disabled={isReadOnly}
              className="text-green-600 dark:text-green-400 font-medium hover:underline mt-2 disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
            >
              Crear mi primer grupo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
