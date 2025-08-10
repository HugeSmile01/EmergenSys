import locationService from './locationService.js';
import DOMPurify from 'dompurify';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

/**
 * Initialize the location component
 */
export function initLocationComponent() {
  const locationToggle = document.getElementById('shareLocation');
  locationToggle.checked = false; // Default to off
  
  // Set up event listeners
  document.getElementById('saveManualLocation').addEventListener('click', saveManualLocation);
}

/**
 * Handle location sharing toggle
 * @param {boolean} enabled - Whether location sharing is enabled
 */
export async function toggleLocationSharing(enabled) {
  const statusElem = document.getElementById('locationStatus');
  const manualInputElem = document.getElementById('manualLocationInput');
  
  // Reset UI
  statusElem.classList.remove('text-red-500', 'text-green-500');
  statusElem.classList.add('hidden');
  manualInputElem.classList.add('hidden');
  
  if (enabled) {
    statusElem.textContent = "Requesting your location...";
    statusElem.classList.remove('hidden');
    
    try {
      const position = await locationService.requestLocation();
      if (position) {
        statusElem.textContent = "✓ Location successfully detected";
        statusElem.classList.add('text-green-500');
        saveLocationToReport(position);
      } else {
        throw new Error("Unable to get your location");
      }
    } catch (error) {
      // Handle error and offer manual input
      statusElem.textContent = "Could not access your location. You can enter it manually.";
      statusElem.classList.add('text-red-500');
      manualInputElem.classList.remove('hidden');
    }
  } else {
    // User disabled location sharing
    locationService.clearLocation();
    removeLocationFromReport();
  }
}

/**
 * Save manually entered location
 */
export function saveManualLocation() {
  const address = DOMPurify.sanitize(document.getElementById('addressInput').value.trim());
  const city = DOMPurify.sanitize(document.getElementById('cityInput').value.trim());
  
  if (!address || !city) {
    alert("Please enter both address and city");
    return;
  }
  
  // For a real implementation, you would geocode this address
  // Here we're just storing the text for simplicity
  const manualLocation = {
    address,
    city,
    isManual: true,
    timestamp: Date.now()
  };
  
  locationService.setManualLocation(manualLocation);
  saveLocationToReport(manualLocation);
  
  const statusElem = document.getElementById('locationStatus');
  statusElem.textContent = "✓ Manual location saved";
  statusElem.classList.remove('hidden', 'text-red-500');
  statusElem.classList.add('text-green-500');
  
  document.getElementById('manualLocationInput').classList.add('hidden');
}

/**
 * Save location data to the emergency report
 * @param {Object} location - Location data to save
 */
async function saveLocationToReport(location) {
  try {
    // Get current report ID from your app state or session
    const reportId = getCurrentReportId(); // Implement this function based on your app
    
    if (!reportId) return;
    
    const db = getFirestore();
    await updateDoc(doc(db, "emergencyReports", reportId), {
      location: location,
      locationUpdatedAt: new Date().toISOString()
    });
    
    console.log("Location added to report");
  } catch (error) {
    console.error("Error saving location:", error);
  }
}

/**
 * Remove location data from the report
 */
async function removeLocationFromReport() {
  try {
    const reportId = getCurrentReportId();
    
    if (!reportId) return;
    
    const db = getFirestore();
    await updateDoc(doc(db, "emergencyReports", reportId), {
      location: null,
      locationUpdatedAt: new Date().toISOString()
    });
    
    console.log("Location removed from report");
  } catch (error) {
    console.error("Error removing location:", error);
  }
}

/**
 * Helper to get current report ID
 * Implement according to your application structure
 */
function getCurrentReportId() {
  // This is a placeholder - implement based on your app structure
  // Could be from URL params, state management, etc.
  return sessionStorage.getItem('currentEmergencyReportId');
}