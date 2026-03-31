from __future__ import annotations

from sqlalchemy.orm import Session

from . import models


DEFAULT_CONTEXTUAL_HELP_PAGES: list[dict[str, object]] = [
    {
        "slug": "home",
        "page_name": "Resumen de Programación",
        "description": "Entrega una vista general del período activo con indicadores, horas y distribución por grupos.",
        "sections": [
            {"title": "Indicadores operativos", "content": "Resume funcionarios activos, programados y sin programación para detectar desbalances rápidamente."},
            {"title": "Bloque de inactividad", "content": "Muestra renuncias y movimientos para interpretar variaciones del período."},
            {"title": "Gráficos", "content": "Permiten comparar horas contractuales y distribución de carga entre grupos y períodos."},
        ],
    },
    {
        "slug": "usuarios",
        "page_name": "Usuarios",
        "description": "Permite administrar cuentas internas, roles, estado de acceso y credenciales del sistema.",
        "sections": [
            {"title": "Barra de búsqueda", "content": "Filtra usuarios por nombre, correo o RUT para encontrar registros rápidamente."},
            {"title": "Tabla de usuarios", "content": "Muestra rol, estado y último acceso para controlar permisos y actividad."},
            {"title": "Alta y edición", "content": "Desde el formulario se crean usuarios o se actualizan sus datos y contraseña."},
        ],
    },
    {
        "slug": "periodos",
        "page_name": "Períodos de Programación",
        "description": "Centraliza la creación, activación y cierre de períodos usados por toda la programación.",
        "sections": [
            {"title": "Listado de períodos", "content": "Permite revisar fechas, estado y disponibilidad histórica de cada período."},
            {"title": "Acciones por período", "content": "Editar, activar, ocultar o eliminar cambia el contexto operativo del sistema."},
            {"title": "Formulario", "content": "Define nombre, rango de fechas y estado inicial del período."},
        ],
    },
    {
        "slug": "rrhh",
        "page_name": "Recursos Humanos",
        "description": "Sirve para cargar el archivo maestro de funcionarios y actualizar la base operativa del período seleccionado.",
        "sections": [
            {"title": "Indicador de período", "content": "Confirma sobre qué período impactará la importación antes de ejecutar cambios."},
            {"title": "Panel de carga", "content": "Recibe archivos Excel válidos y muestra el resultado de creación o actualización."},
            {"title": "Modo lectura", "content": "Cuando el período es histórico, bloquea modificaciones para proteger la trazabilidad."},
        ],
    },
    {
        "slug": "carga",
        "page_name": "Carga de Datos",
        "description": "Administra catálogos complementarios como especialidades, procesos, actividades y unidades de desempeño.",
        "sections": [
            {"title": "Selector de catálogo", "content": "Define qué tipo de dato maestro será cargado o eliminado para el período actual."},
            {"title": "Panel de carga", "content": "Permite subir planillas, descargar plantillas y ejecutar borrados controlados."},
            {"title": "Mensajes de resultado", "content": "Informan si la operación terminó bien o si el archivo tiene errores."},
        ],
    },
    {
        "slug": "funcionarios",
        "page_name": "Funcionarios",
        "description": "Muestra el padrón operativo del usuario y permite buscar, activar o desvincular funcionarios según permisos.",
        "sections": [
            {"title": "Filtros y búsqueda", "content": "Ayudan a acotar el listado por nombre, RUT, ley, especialidad, horas y estado."},
            {"title": "Tabla principal", "content": "Resume antecedentes contractuales y el estado operativo de cada funcionario."},
            {"title": "Modales de gestión", "content": "Controlan altas, reactivaciones y desvinculaciones con validaciones y motivos."},
        ],
    },
    {
        "slug": "programacion",
        "page_name": "Programación",
        "description": "Organiza funcionarios en grupos y prepara la asignación de actividades del período activo.",
        "sections": [
            {"title": "Buscador superior", "content": "Encuentra funcionarios del ámbito del usuario para asignarlos a grupos existentes."},
            {"title": "Panel de grupos", "content": "Muestra grupos creados y permite administrarlos cuando el período admite edición."},
            {"title": "Resumen lateral", "content": "Separa funcionarios programados y no programados para priorizar la gestión."},
        ],
    },
    {
        "slug": "programacion-grupo",
        "page_name": "Detalle de Grupo",
        "description": "Permite revisar y editar la programación de los funcionarios asociados a un grupo específico.",
        "sections": [
            {"title": "Cabecera del grupo", "content": "Identifica el grupo, cantidad de integrantes y acciones de navegación o alta."},
            {"title": "Buscador interno", "content": "Filtra rápidamente a los integrantes del grupo por nombre o RUT."},
            {"title": "Listado y modal de programación", "content": "Desde aquí se abre el detalle de cada funcionario para editar su planificación."},
        ],
    },
    {
        "slug": "programacion-programados",
        "page_name": "Funcionarios Programados",
        "description": "Lista solo funcionarios con programación vigente para revisar su carga y navegar al detalle individual.",
        "sections": [
            {"title": "Cabecera de listado", "content": "Muestra el volumen total de funcionarios ya programados en el período."},
            {"title": "Buscador", "content": "Permite ubicar rápidamente a una persona dentro del conjunto programado."},
            {"title": "Listado", "content": "Cada fila abre el modal detallado del funcionario seleccionado."},
        ],
    },
    {
        "slug": "programacion-no-programados",
        "page_name": "Funcionarios No Programados",
        "description": "Lista funcionarios activos sin asignación para facilitar el seguimiento de pendientes.",
        "sections": [
            {"title": "Cabecera de listado", "content": "Identifica el total pendiente y permite volver al tablero principal de programación."},
            {"title": "Buscador", "content": "Ayuda a localizar rápidamente funcionarios aún no programados."},
            {"title": "Listado", "content": "Permite abrir el detalle individual para completar la programación faltante."},
        ],
    },
    {
        "slug": "ayudas-contextuales",
        "page_name": "Ayudas Contextuales",
        "description": "Pantalla administrativa para mantener el contenido de ayuda disponible en cada página relevante.",
        "sections": [
            {"title": "Listado de páginas", "content": "Permite seleccionar qué ayuda contextual se desea revisar o editar."},
            {"title": "Formulario de edición", "content": "Actualiza título, resumen y secciones explicativas de cada página."},
            {"title": "Guardar cambios", "content": "Persiste la ayuda y la deja disponible inmediatamente para los usuarios autorizados."},
        ],
    },
]


def ensure_default_contextual_help(db: Session) -> int:
    existing_slugs = {
        slug
        for slug, in db.query(models.ContextualHelpPage.slug).all()
    }
    created_count = 0

    for page_data in DEFAULT_CONTEXTUAL_HELP_PAGES:
        slug = str(page_data["slug"])
        if slug in existing_slugs:
            continue

        page = models.ContextualHelpPage(
            slug=slug,
            page_name=str(page_data["page_name"]),
            description=str(page_data.get("description") or ""),
        )

        for index, section in enumerate(page_data.get("sections", []), start=1):
            page.sections.append(
                models.ContextualHelpSection(
                    position=index,
                    title=str(section["title"]),
                    content=str(section["content"]),
                )
            )

        db.add(page)
        created_count += 1

    if created_count:
        db.commit()

    return created_count
