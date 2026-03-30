import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRut(rut: string): string {
  if (!rut) return rut;
  
  // Clean the RUT first
  const value = rut.replace(/[.-]/g, "").replace(/\s/g, "");
  
  if (value.length === 0) return "";
  
  // Separate the check digit
  const dv = value.slice(-1);
  let body = value.slice(0, -1);
  
  if (body.length === 0) return value; // Just one character
  
  // Format the body with dots
  body = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  
  return `${body}-${dv}`;
}

export function validateRut(rut: string): boolean {
  if (!rut) return false;
  
  // Clean the RUT
  const value = rut.replace(/[.-]/g, "").replace(/\s/g, "");
  
  if (value.length < 2) return false;
  
  const body = value.slice(0, -1);
  const dv = value.slice(-1).toUpperCase();
  
  // Check if body is numeric
  if (!/^\d+$/.test(body)) return false;
  
  // Calculate expected DV
  let sum = 0;
  let multiplier = 2;
  
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const expectedDvVal = 11 - (sum % 11);
  let expectedDv = "";
  
  if (expectedDvVal === 11) expectedDv = "0";
  else if (expectedDvVal === 10) expectedDv = "K";
  else expectedDv = expectedDvVal.toString();
  
  return dv === expectedDv;
}
