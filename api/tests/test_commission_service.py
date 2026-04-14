from api import commission_service, models


def test_partial_commission_detection_prefers_system_keys_over_names() -> None:
    reason = models.DismissReason(system_key="comision-servicio", name="Nombre editable")
    suboption = models.DismissReasonSuboption(system_key="parcial", name="Texto editable")

    assert commission_service.is_partial_commission_selection(reason, suboption) is True


def test_partial_commission_detection_keeps_legacy_name_fallback() -> None:
    reason = models.DismissReason(system_key=None, name="Comisión de Servicio")
    suboption = models.DismissReasonSuboption(system_key=None, name="Parcial")

    assert commission_service.is_partial_commission_selection(reason, suboption) is True


def test_partial_commission_detection_rejects_non_partial_suboption_even_with_reason_key() -> None:
    reason = models.DismissReason(system_key="comision-servicio", name="Nombre editable")
    suboption = models.DismissReasonSuboption(system_key="total", name="Total")

    assert commission_service.is_partial_commission_selection(reason, suboption) is False
