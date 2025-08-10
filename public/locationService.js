/**
 * Optional location service for EmergenSys
 * Provides geolocation with user consent and fallback options
 */
class LocationService {
  constructor() {
    this.locationAvailable = false;
    this.currentLocation = null;
  }

  /**
   * Request user location with proper error handling
   * @returns {Promise<GeolocationPosition|null>}
   */
  async requestLocation() {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      console.log("Geolocation not supported by this browser");
      return null;
    }
    
    try {
      // Request user permission and location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      this.locationAvailable = true;
      this.currentLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };
      
      // Return sanitized location object (no references to original)
      return { ...this.currentLocation };
    } catch (error) {
      console.log("Error getting location:", error.message);
      return null;
    }
  }
  
  /**
   * Allow user to manually enter location
   * @param {Object} location - User provided location
   */
  setManualLocation(location) {
    if (this.validateLocation(location)) {
      this.locationAvailable = true;
      this.currentLocation = { 
        ...location,
        isManual: true,
        timestamp: Date.now()
      };
      return true;
    }
    return false;
  }
  
  /**
   * Validate user-provided location
   * @param {Object} location - Location to validate
   */
  validateLocation(location) {
    // Basic validation - could be enhanced
    return (
      location &&
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number' &&
      location.latitude >= -90 && location.latitude <= 90 &&
      location.longitude >= -180 && location.longitude <= 180
    );
  }
  
  /**
   * Get current location if available
   * @returns {Object|null}
   */
  getLocation() {
    return this.locationAvailable ? { ...this.currentLocation } : null;
  }
  
  /**
   * Clear stored location data
   */
  clearLocation() {
    this.locationAvailable = false;
    this.currentLocation = null;
  }
}

export default new LocationService();