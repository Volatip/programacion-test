import { useOfficials, Funcionario } from "../context/OfficialsContext";
import { usePeriods } from "../context/PeriodsContext";

export function useProgrammingClassification() {
  const { officials } = useOfficials();
  const { selectedPeriod } = usePeriods();

  // Helper to parse contract hours and calculate available hours
  const calculateAvailableHours = (f: Funcionario) => {
    // 1. Calculate Total Contract Hours
    let totalContractHours = 0;
    
    // Check if we have detailed contracts
    if (f.contracts && f.contracts.length > 0) {
        totalContractHours = f.contracts.reduce((acc, contract) => {
            const isLaw15076 = contract.law_code && contract.law_code.includes("15076");
            const obs = (contract.observations || "").toLowerCase();
            const isLiberadoGuardia = obs.includes("liberado de guardia");
            
            // Condition: Law 15076 AND NOT Liberado de Guardia -> Exclude from sum
            if (isLaw15076 && !isLiberadoGuardia) {
                return acc;
            }
            return acc + contract.hours;
        }, 0);
    } else {
        // Fallback to string parsing
        const hoursStr = String(f.hours);
        // If it's just a number
        if (!isNaN(Number(hoursStr))) {
             totalContractHours = Number(hoursStr);
        } else {
            // Handle "22 hrs y 11 hrs"
            const parts = hoursStr.split(' y ');
            for (const part of parts) {
                 const val = parseFloat(part.replace(' hrs', '').trim());
                 if (!isNaN(val)) totalContractHours += val;
            }
        }
    }
    
    // 2. Get Scheduled Hours
    const scheduled = f.totalScheduledHours || 0;
    
    // 3. Lunch Time
    const lunchMinutes = parseFloat(f.lunchTime.replace(' min', '')) || 0;
    const lunchHours = lunchMinutes / 60;
    
    return totalContractHours - scheduled - lunchHours;
  };

  const isProgrammed = (f: Funcionario) => {
    if (f.status !== 'activo') return false;
    
    // Must be marked as scheduled first (backend flag based on existence of record)
    if (!f.isScheduled) return false;
    
    // Condition 1: Available Hours == 0
    const available = calculateAvailableHours(f);
    // Use epsilon for float comparison (precision issues)
    const isZero = Math.abs(available) < 0.05; 
    
    if (!isZero) return false;
    
    // Condition 2: Updated At within Period
    if (!selectedPeriod || !f.programmingUpdatedAt) return false;
    
    const updated = new Date(f.programmingUpdatedAt);
    const start = new Date(selectedPeriod.start_date);
    const end = new Date(selectedPeriod.end_date);
    // Ensure end date includes the full day
    end.setHours(23, 59, 59, 999);
    
    // Check if updated date is valid
    if (isNaN(updated.getTime())) return false;
    
    // Compare
    return updated >= start && updated <= end;
  };

  const scheduledFuncionarios = officials.filter(f => isProgrammed(f));
  const unscheduledFuncionarios = officials.filter(f => f.status === 'activo' && !isProgrammed(f));

  return {
    scheduledFuncionarios,
    unscheduledFuncionarios,
    isProgrammed,
    calculateAvailableHours
  };
}
