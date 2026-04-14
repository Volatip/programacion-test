from __future__ import annotations

from sqlalchemy import inspect
from sqlalchemy.orm import Session, object_session

from . import models


def _build_sections(page: models.ContextualHelpPage, sections: list[dict[str, str]]) -> None:
    page.sections.clear()
    session = object_session(page)
    if session is not None and inspect(page).persistent:
        session.flush()

    for index, section in enumerate(sections, start=1):
        page.sections.append(
            models.ContextualHelpSection(
                position=index,
                title=str(section["title"]),
                content=str(section["content"]),
            )
        )


def _page_matches_defaults(page: models.ContextualHelpPage, page_data: dict[str, object]) -> bool:
    expected_sections = page_data.get("sections", [])
    if page.page_name != str(page_data["page_name"]):
        return False
    if (page.description or "") != str(page_data.get("description") or ""):
        return False
    if len(page.sections) != len(expected_sections):
        return False

    for position, (section, expected) in enumerate(zip(page.sections, expected_sections), start=1):
        if section.position != position:
            return False
        if section.title != str(expected["title"]):
            return False
        if section.content != str(expected["content"]):
            return False

    return True


def _apply_page_defaults(page: models.ContextualHelpPage, page_data: dict[str, object]) -> None:
    page.page_name = str(page_data["page_name"])
    page.description = str(page_data.get("description") or "")
    _build_sections(page, list(page_data.get("sections", [])))


DEFAULT_CONTEXTUAL_HELP_PAGES: list[dict[str, object]] = [
    {
        "slug": "home",
        "page_name": "Resumen de Programación",
        "description": "Resume el estado operativo del período seleccionado con hitos, métricas de programación e indicadores de inactividad.",
        "sections": [
            {"title": "Línea de tiempo", "content": "Expone hitos y mensajes operativos definidos por administración para orientar el trabajo del período actual. Si eres administrador, puedes editar este bloque sin salir de la pantalla."},
            {"title": "Estado operativo", "content": "Muestra cuántos funcionarios activos ya están programados y cuántos siguen pendientes. Úsalo como semáforo rápido para priorizar gestión."},
            {"title": "Inactividad y movimientos", "content": "Separa inactivos totales, renuncias y movilidad para interpretar por qué cambia la dotación visible entre períodos."},
        ],
    },
    {
        "slug": "usuarios",
        "page_name": "Usuarios",
        "description": "Administra cuentas internas, permisos y credenciales de acceso para operar la plataforma según el rol asignado.",
        "sections": [
            {"title": "Búsqueda y acciones", "content": "El buscador filtra por nombre, correo o RUT. Desde aquí también puedes crear nuevas cuentas cuando corresponda."},
            {"title": "Tabla de usuarios", "content": "Cada fila muestra identidad, rol, estado y fecha de último acceso para revisar permisos vigentes y actividad reciente."},
            {"title": "Alta, edición y baja", "content": "Los formularios permiten crear usuarios, corregir sus datos, cambiar contraseñas y desactivar accesos cuando dejan de requerirse."},
        ],
    },
    {
        "slug": "periodos",
        "page_name": "Períodos de Programación",
        "description": "Centraliza la creación y administración de períodos para definir el contexto activo de carga, programación y reportes.",
        "sections": [
            {"title": "Listado de períodos", "content": "Permite revisar nombre, fechas y estado de cada período disponible para operar o consultar histórico."},
            {"title": "Estados y acciones", "content": "Activar un período cambia el contexto visible en módulos dependientes. Ocultar o editar afecta cómo se disponibiliza ese ciclo al resto del sistema."},
            {"title": "Formulario de mantención", "content": "Aquí defines nombre, rango de fechas y estado inicial del período antes de guardarlo."},
        ],
    },
    {
        "slug": "rrhh",
        "page_name": "Recursos Humanos",
        "description": "Importa la nómina maestra de RRHH y permite administrar lotes cargados para mantener actualizada la base operativa del período seleccionado.",
        "sections": [
            {"title": "Indicadores superiores", "content": "Muestran el período seleccionado y si la pantalla está en modo lectura. Verifica ese contexto antes de importar o eliminar información."},
            {"title": "Carga de archivo RRHH", "content": "Recibe la planilla maestra y procesa altas o actualizaciones de funcionarios según el formato esperado por backend."},
            {"title": "Gestión de lotes", "content": "Además de cargar, puedes eliminar el último lote o borrar lotes por fecha cuando necesites revertir una importación controlada."},
        ],
    },
    {
        "slug": "carga",
        "page_name": "Carga de Datos",
        "description": "Mantiene catálogos operativos del período, como especialidades, procesos, actividades y otras tablas de apoyo para programación.",
        "sections": [
            {"title": "Selector de catálogo", "content": "Define qué maestro vas a administrar. Cambiar esta opción ajusta la plantilla, validaciones y endpoints usados en la carga."},
            {"title": "Panel de importación", "content": "Permite descargar plantillas, subir archivos válidos y ejecutar eliminaciones controladas para el catálogo seleccionado."},
            {"title": "Mensajes y modo lectura", "content": "Los mensajes explican si la operación fue exitosa o si el archivo requiere correcciones. En períodos históricos la carga queda bloqueada."},
        ],
    },
    {
        "slug": "funcionarios",
        "page_name": "Funcionarios",
        "description": "Consolida la nómina operativa del ámbito del usuario y permite buscar, revisar y gestionar el estado de cada funcionario según permisos.",
        "sections": [
            {"title": "Búsqueda y filtros", "content": "Ayudan a reducir el listado por nombre, RUT, ley, especialidad, horas, estado y otros atributos relevantes para la gestión."},
            {"title": "Tabla principal", "content": "Resume antecedentes contractuales, condición operativa y datos clave para decidir si corresponde programar, reasignar o dar de baja."},
            {"title": "Acciones de gestión", "content": "Desde los modales puedes incorporar funcionarios, reactivarlos o ejecutar bajas con los motivos y subopciones configurados por administración."},
        ],
    },
    {
        "slug": "general",
        "page_name": "General",
        "description": "Entrega una vista consolidada por usuario del período seleccionado, combinando datos contractuales, asignación operativa y estado de programación.",
        "sections": [
            {"title": "Búsqueda y filtros avanzados", "content": "El buscador principal revisa funcionario, título, ley, especialidad, estado, usuario y condición de programación. Los filtros adicionales se combinan entre sí para refinar el consolidado."},
            {"title": "Lectura del consolidado", "content": "Las columnas resumen perfil contractual, horas detectadas y estado operativo informado por RRHH para cada persona dentro del período seleccionado."},
            {"title": "Usuario y Programado", "content": "Usuario indica a qué cuentas activas quedó asociado el funcionario. Programado informa si al menos uno de sus contratos del período ya registra planificación."},
        ],
    },
    {
        "slug": "programacion",
        "page_name": "Programación",
        "description": "Organiza funcionarios en grupos de trabajo y sirve como punto de entrada para completar la programación del período activo.",
        "sections": [
            {"title": "Buscador superior", "content": "Ubica funcionarios del ámbito del usuario y facilita enviarlos a grupos o revisar su estado de programación."},
            {"title": "Panel de grupos", "content": "Lista grupos existentes, permite crearlos y administrarlos cuando el período admite edición."},
            {"title": "Resumen de avance", "content": "Separa funcionarios programados y no programados para priorizar pendientes y navegar a los listados especializados."},
        ],
    },
    {
        "slug": "programacion-grupo",
        "page_name": "Detalle de Grupo",
        "description": "Permite revisar los integrantes de un grupo y abrir la programación individual de cada funcionario asociado.",
        "sections": [
            {"title": "Cabecera del grupo", "content": "Identifica el grupo, muestra su cantidad de integrantes y ofrece acciones para volver o agregar funcionarios si el contexto lo permite."},
            {"title": "Buscador interno", "content": "Filtra rápidamente por nombre o RUT cuando el grupo tiene muchos integrantes."},
            {"title": "Listado y detalle", "content": "Cada fila abre el modal de programación individual para revisar o editar actividades, según permisos y estado del período."},
        ],
    },
    {
        "slug": "programacion-programados",
        "page_name": "Funcionarios Programados",
        "description": "Muestra solo funcionarios activos que ya poseen programación registrada en el período y permite revisar su detalle individual.",
        "sections": [
            {"title": "Cabecera de listado", "content": "Resume el total de funcionarios ya programados y permite volver al tablero principal de programación."},
            {"title": "Buscador", "content": "Ayuda a ubicar por nombre o RUT a una persona dentro del conjunto programado."},
            {"title": "Listado y navegación", "content": "Cada fila abre el modal de programación del funcionario y permite avanzar o retroceder entre resultados filtrados."},
        ],
    },
    {
        "slug": "programacion-no-programados",
        "page_name": "Funcionarios No Programados",
        "description": "Muestra funcionarios activos que aún no poseen programación registrada para facilitar el seguimiento de pendientes del período.",
        "sections": [
            {"title": "Cabecera de listado", "content": "Identifica el total pendiente y ofrece acceso rápido de regreso al tablero principal de programación."},
            {"title": "Buscador", "content": "Permite localizar rápidamente por nombre o RUT a quienes siguen sin programación."},
            {"title": "Listado y detalle", "content": "Cada fila abre el modal individual para completar la programación faltante y navegar entre pendientes."},
        ],
    },
    {
        "slug": "bajas",
        "page_name": "Bajas",
        "description": "Administra los motivos y subopciones usados por el flujo de baja o exclusión operativa de funcionarios.",
        "sections": [
            {"title": "Listado de motivos", "content": "La columna izquierda muestra los motivos existentes, su orden y si están activos para el flujo operativo."},
            {"title": "Formulario del motivo", "content": "Permite definir nombre, categoría de reporte, comportamiento y si el motivo exige fecha de inicio antes de guardarlo."},
            {"title": "Subopciones", "content": "Cada motivo puede tener subopciones para refinar el caso aplicado en la baja. Úsalas cuando el proceso requiera distinguir escenarios internos."},
        ],
    },
    {
        "slug": "admin-correo",
        "page_name": "Correo",
        "description": "Configura el envío SMTP y la plantilla utilizada cuando una programación requiere revisión con estado “Arreglar”.",
        "sections": [
            {"title": "Configuración SMTP", "content": "Aquí defines host, puerto, credenciales, remitente y tipo de seguridad para habilitar el envío de correos desde la plataforma."},
            {"title": "Correo de prueba", "content": "Envía una prueba usando la configuración guardada actualmente para validar conectividad, autenticación y remitente antes de operar."},
            {"title": "Plantilla del aviso", "content": "Permite editar asunto y cuerpo del correo automático usando las variables disponibles para personalizar el mensaje enviado al pedir correcciones."},
        ],
    },
    {
        "slug": "estadisticas",
        "page_name": "Estadísticas",
        "description": "Entrega métricas comparativas del período, horas asociadas a programación y distribución por grupos dentro del ámbito visible del usuario.",
        "sections": [
            {"title": "Contexto y alcance", "content": "El encabezado muestra el período consultado y, para supervisores, el usuario actualmente seleccionado como ámbito de análisis."},
            {"title": "Gráfico de horas", "content": "Compara horas contrato e indicadores de turnos por período para entender evolución y magnitud de la carga programada."},
            {"title": "Detalle y distribución por grupos", "content": "El panel lateral resume el período actual y el gráfico por grupos ayuda a detectar dónde se concentra la carga y cuántos funcionarios participan."},
        ],
    },
    {
        "slug": "ayudas-contextuales",
        "page_name": "Ayudas Contextuales",
        "description": "Pantalla administrativa para mantener el contenido de ayuda mostrado en cada módulo que dispone de orientación contextual.",
        "sections": [
            {"title": "Listado de páginas", "content": "Permite seleccionar una ayuda existente o iniciar una nueva para una pantalla que aún no tenga contenido."},
            {"title": "Formulario de edición", "content": "Aquí se actualizan nombre visible, descripción general y las secciones explicativas mostradas en el modal."},
            {"title": "Guardado y publicación", "content": "Al guardar, el contenido queda disponible inmediatamente desde el botón de ayuda de la página correspondiente."},
        ],
    },
]


def ensure_default_contextual_help(db: Session) -> int:
    existing_pages = {
        page.slug: page
        for page in db.query(models.ContextualHelpPage).all()
    }
    affected_count = 0

    for page_data in DEFAULT_CONTEXTUAL_HELP_PAGES:
        slug = str(page_data["slug"])
        page = existing_pages.get(slug)

        if page is None:
            page = models.ContextualHelpPage(slug=slug)
            _apply_page_defaults(page, page_data)
            db.add(page)
            affected_count += 1
            continue

        if page.updated_by_id is None and not _page_matches_defaults(page, page_data):
            _apply_page_defaults(page, page_data)
            affected_count += 1

    if affected_count:
        db.commit()

    return affected_count
