// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getDatabase, ref, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

/**
 * EmergenSys - Emergency Reporting System
 * Main application script
 */

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC0gGIsNNRPXuGNx9xpuOEuCtJmh7Uvcsw",
  authDomain: "silago911.firebaseapp.com",
  projectId: "silago911",
  databaseURL: "https://silago911-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "silago911.appspot.com",
  messagingSenderId: "624672428258",
  appId: "1:624672428258:web:2c9038f5e789b34054cebb",
  measurementId: "G-QBZSJ9HH1Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);

// DOM elements
const form = document.getElementById('emergencyForm');
const typeSelect = document.getElementById('type');
const descField = document.getElementById('desc');
const locationField = document.getElementById('location');
const typeError = document.getElementById('typeError');
const descError = document.getElementById('descError');
const locationError = document.getElementById('locationError');
const loading = document.getElementById('loading');
const submitBtn = document.getElementById('submitBtn');
const resetBtn = document.getElementById('resetBtn');
const alert = document.getElementById('alert');
const alertMessage = document.getElementById('alertMessage');
const locationConsent = document.getElementById('locationConsent');
const getLocationBtn = document.getElementById('getLocationBtn');
const charCount = document.getElementById('charCount');
const quickEmergencyBtns = document.querySelectorAll('.emergency-type-btn');
const safetyTips = document.getElementById('safetyTips');
const safetyContent = document.getElementById('safetyContent');
const mapContainer = document.getElementById('mapContainer');
const mediaButton = document.getElementById('mediaButton');
const mediaInput = document.getElementById('media');
const previewContainer = document.getElementById('previewContainer');
const darkModeToggle = document.getElementById('darkModeToggle');
const increaseVictimsBtn = document.getElementById('increaseVictims');
const decreaseVictimsBtn = document.getElementById('decreaseVictims');
const victimsInput = document.getElementById('victims');
const callButton = document.getElementById('callButton');
const statusModal = document.getElementById('statusModal');
const closeModal = document.getElementById('closeModal');
const modalType = document.getElementById('modalType');
const modalStatus = document.getElementById('modalStatus');
const modalTime = document.getElementById('modalTime');
const reportId = document.getElementById('reportId');

// Global variables
let currentPosition = null;
let map = null;
let marker = null;
let mediaFiles = [];
let geocoder = null;
let emergencyMainCategory = null;

// Alert types
const ALERT_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning'
};

// Safety tips by emergency type
const SAFETY_TIPS = {
  "Fire": [
    "Move away from the fire to a safe location",
    "If trapped, stay low to the ground to avoid smoke inhalation",
    "Do not use elevators during a fire emergency",
    "Feel doors before opening them - if hot, find another exit"
  ],
  "Medical": [
    "Keep the person still and comfortable",
    "For cardiac arrest, perform CPR if trained",
    "For choking, perform the Heimlich maneuver if trained",
    "Monitor breathing and consciousness until help arrives"
  ],
  "Crime": [
    "Move to a safe location away from the incident",
    "Do not confront suspects",
    "Try to remember identifying details to report",
    "Lock doors and windows if possible"
  ],
  "Traffic": [
    "Turn on hazard lights and place warning triangles if available",
    "Move to a safe location away from traffic",
    "Do not move seriously injured victims unless immediate danger exists",
    "Use reflective clothing or flashlights at night to be visible"
  ],
  "Natural": [
    "Move to higher ground during flooding",
    "For earthquakes, drop, cover, and hold on",
    "For tornadoes, seek shelter in an interior room on the lowest floor",
    "Stay away from windows and outside walls during severe weather"
  ],
  "Other": [
    "Assess the situation for immediate dangers",
    "Help others reach safety if possible",
    "Follow instructions from emergency personnel",
    "Document the incident if safe to do so"
  ]
};

/**
 * Initialize the application when DOM content is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Check for dark mode preference
  if (localStorage.getItem('darkMode') === 'enabled' || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches && 
       localStorage.getItem('darkMode') !== 'disabled')) {
    document.documentElement.classList.add('dark');
    darkModeToggle.textContent = '☀️';
  }

  // Set current date for report ID
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  reportId.textContent = `EM-${dateStr}-${randomNum}`;
  modalTime.textContent = now.toISOString().replace('T', ' ').slice(0, 19);

  // Initialize event listeners
  initEventListeners();
  
  // Check for geolocation support
  if (navigator.geolocation) {
    getLocationBtn.addEventListener('click', getCurrentLocation);
  } else {
    showAlert("Your browser doesn't support geolocation. Please enter your location manually.", ALERT_TYPES.WARNING);
    getLocationBtn.disabled = true;
    getLocationBtn.classList.add('opacity-50');
  }

  // Initialize Google Maps if API is loaded
  if (window.google && google.maps) {
    initMap();
  } else {
    // Add event listener for when Google Maps API loads
    window.initMap = initMap;
  }

  // First time visitors notification
  if (!localStorage.getItem('visitedBefore')) {
    setTimeout(() => {
      showAlert("Welcome to EmergenSys! This system helps you report emergencies quickly. In life-threatening situations, always call emergency services directly.", ALERT_TYPES.WARNING, 10000);
      localStorage.setItem('visitedBefore', 'true');
    }, 1000);
  }
});

/**
 * Initialize all event listeners
 */
function initEventListeners() {
  // Form submission
  form.addEventListener('submit', handleSubmit);
  
  // Reset button
  resetBtn.addEventListener('click', resetForm);
  
  // Dark mode toggle
  darkModeToggle.addEventListener('click', toggleDarkMode);
  
  // Description character count
  descField.addEventListener('input', updateCharCount);
  
  // Victim count buttons
  increaseVictimsBtn.addEventListener('click', () => {
    victimsInput.value = Math.min(parseInt(victimsInput.value) + 1, 999);
  });
  
  decreaseVictimsBtn.addEventListener('click', () => {
    victimsInput.value = Math.max(parseInt(victimsInput.value) - 1, 0);
  });
  
  // Input validation
  typeSelect.addEventListener('change', () => {
    if (typeSelect.value) {
      typeError.classList.add('hidden');
      updateSafetyTips(typeSelect.value);
    }
  });
  
  descField.addEventListener('input', () => {
    if (descField.value && descField.value.trim().length >= 10) {
      descError.classList.add('hidden');
    }
  });
  
  locationField.addEventListener('input', () => {
    if (locationField.value) {
      locationError.classList.add('hidden');
    }
  });
  
  // Media upload
  mediaButton.addEventListener('click', () => {
    mediaInput.click();
  });
  
  mediaInput.addEventListener('change', handleMediaSelection);
  
  // Quick emergency type buttons
  quickEmergencyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove selected class from all buttons
      quickEmergencyBtns.forEach(b => b.classList.remove('selected'));
      
      // Add selected class to clicked button
      btn.classList.add('selected');
      
      // Get the emergency type
      emergencyMainCategory = btn.dataset.type;
      
      // Filter the select options
      filterTypeOptions(emergencyMainCategory);
      
      // Update safety tips
      updateSafetyTips(emergencyMainCategory);
    });
  });
  
  // Call button
  callButton.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('This will dial emergency services (911). Continue?')) {
      window.location.href = 'tel:911';
    }
  });
  
  // Modal close button
  closeModal.addEventListener('click', () => {
    statusModal.classList.add('fade-out');
    setTimeout(() => {
      statusModal.classList.remove('fade-out');
      statusModal.classList.add('hidden');
    }, 300);
  });
  
  // Initialize character counter
  updateCharCount();
}

/**
 * Toggle dark mode
 */
function toggleDarkMode() {
  if (document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('darkMode', 'disabled');
    darkModeToggle.textContent = '🌙';
  } else {
    document.documentElement.classList.add('dark');
    localStorage.setItem('darkMode', 'enabled');
    darkModeToggle.textContent = '☀️';
  }
}

/**
 * Update character count for description field
 */
function updateCharCount() {
  const count = descField.value.length;
  charCount.textContent = `${count} character${count !== 1 ? 's' : ''}`;
  
  // Change color based on count
  if (count < 10) {
    charCount.className = 'text-xs text-red-500 dark:text-red-400';
  } else if (count < 30) {
    charCount.className = 'text-xs text-yellow-500 dark:text-yellow-400';
  } else {
    charCount.className = 'text-xs text-green-500 dark:text-green-400';
  }
}

/**
 * Filter type options based on selected main category
 * @param {string} category - Main emergency category
 */
function filterTypeOptions(category) {
  // Map category to optgroup label
  const categoryMap = {
    'Fire': 'Fire Emergencies',
    'Medical': 'Medical Emergencies',
    'Crime': 'Crime/Violence',
    'Traffic': 'Traffic Incidents',
    'Natural': 'Natural Disasters',
    'Other': 'Other Emergencies'
  };
  
  const optgroupLabel = categoryMap[category] || '';
  
  // Find the optgroup and select first option
  if (optgroupLabel) {
    const optgroup = Array.from(typeSelect.getElementsByTagName('optgroup')).find(
      group => group.label === optgroupLabel
    );
    
    if (optgroup && optgroup.options.length > 0) {
      typeSelect.value = optgroup.options[0].value;
      updateSafetyTips(optgroup.options[0].value);
    }
  }
}

/**
 * Update safety tips based on emergency type
 * @param {string} emergencyType - Type of emergency
 */
function updateSafetyTips(emergencyType) {
  // Determine which category this emergency type belongs to
  let category = 'Other';
  
  if (emergencyType.includes('Fire') || emergencyType.includes('Explosion')) {
    category = 'Fire';
  } else if (['Heart Attack', 'Stroke', 'Breathing', 'Bleeding', 'Unconscious', 'Childbirth', 'Poisoning', 'Allergic'].some(term => emergencyType.includes(term))) {
    category = 'Medical';
  } else if (['Car', 'Vehicle', 'Crash', 'Hit', 'Road', 'Traffic', 'Pedestrian'].some(term => emergencyType.includes(term))) {
    category = 'Traffic';
  } else if (['Assault', 'Robbery', 'Break-in', 'Shooting', 'Violence', 'Suspicious'].some(term => emergencyType.includes(term))) {
    category = 'Crime';
  } else if (['Flood', 'Earthquake', 'Landslide', 'Tornado', 'Hurricane', 'Weather', 'Disaster'].some(term => emergencyType.includes(term))) {
    category = 'Natural';
  }
  
  // Get safety tips for this category
  const tips = SAFETY_TIPS[category];
  
  if (tips && tips.length) {
    // Create bullet points for tips
    const tipsHTML = tips.map(tip => `• ${tip}`).join('<br>');
    safetyContent.innerHTML = tipsHTML;
    safetyTips.classList.remove('hidden');
  } else {
    safetyTips.classList.add('hidden');
  }
}

/**
 * Handle media file selection
 * @param {Event} event - Change event from file input
 */
function handleMediaSelection(event) {
  const files = event.target.files;
  
  if (files.length > 0) {
    // Store the files for upload
    mediaFiles = Array.from(files);
    
    // Show preview container
    previewContainer.classList.remove('hidden');
    previewContainer.innerHTML = '';
    
    // Create previews
    mediaFiles.forEach((file, index) => {
      const preview = document.createElement('div');
      preview.className = 'relative';
      
      if (file.type.startsWith('image/')) {
        // Image preview
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = 'Media preview';
        preview.appendChild(img);
      } else if (file.type.startsWith('video/')) {
        // Video preview
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.controls = false;
        video.muted = true;
        preview.appendChild(video);
        
        // Play icon overlay
        const playIcon = document.createElement('div');
        playIcon.className = 'absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 text-white text-2xl';
        playIcon.innerHTML = '▶️';
        preview.appendChild(playIcon);
      }
      
      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs';
      removeBtn.innerHTML = '×';
      removeBtn.addEventListener('click', () => {
        mediaFiles.splice(index, 1);
        preview.remove();
        if (mediaFiles.length === 0) {
          previewContainer.classList.add('hidden');
        }
      });
      
      preview.appendChild(removeBtn);
      previewContainer.appendChild(preview);
    });
  }
}

/**
 * Initialize Google Maps
 */
function initMap() {
  // Default location (can be changed when user shares location)
  const defaultLocation = { lat: 10.7749, lng: 122.5882 }; // Default to Philippines
  
  // Create geocoder
  geocoder = new google.maps.Geocoder();
  
  // Create map
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 15,
    center: defaultLocation,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false
  });
  
  // Create marker
  marker = new google.maps.Marker({
    position: defaultLocation,
    map: map,
    draggable: true,
    animation: google.maps.Animation.DROP,
    icon: {
      url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
    }
  });
  
  // Add event listener for marker drag end
  google.maps.event.addListener(marker, 'dragend', function() {
    const position = marker.getPosition();
    currentPosition = {
      coords: {
        latitude: position.lat(),
        longitude: position.lng()
      }
    };
    
    // Update location field with address
    geocoder.geocode({ location: position }, (results, status) => {
      if (status === 'OK' && results[0]) {
        locationField.value = results[0].formatted_address;
      }
    });
  });
}

/**
 * Get current location
 */
function getCurrentLocation() {
  if (!navigator.geolocation) {
    showAlert("Your browser doesn't support geolocation.", ALERT_TYPES.ERROR);
    return;
  }
  
  getLocationBtn.disabled = true;
  getLocationBtn.textContent = '...';
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      // Store position for later use
      currentPosition = position;
      
      // Update input field with address
      const latLng = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      // Update map position if map is initialized
      if (map && marker) {
        map.setCenter(latLng);
        marker.setPosition(latLng);
        mapContainer.classList.remove('hidden');
      }
      
      // Get address from coordinates
      if (geocoder) {
        geocoder.geocode({ location: latLng }, (results, status) => {
          if (status === 'OK' && results[0]) {
            locationField.value = results[0].formatted_address;
            locationError.classList.add('hidden');
          } else {
            locationField.value = `${position.coords.latitude}, ${position.coords.longitude}`;
          }
        });
      } else {
        locationField.value = `${position.coords.latitude}, ${position.coords.longitude}`;
      }
      
      getLocationBtn.disabled = false;
      getLocationBtn.textContent = '📍';
    },
    (error) => {
      console.error("Error getting location:", error);
      let errorMessage = "Unable to retrieve your location. ";
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage += "Location access was denied. Please enter your location manually.";
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage += "Location information is unavailable. Please try again or enter manually.";
          break;
        case error.TIMEOUT:
          errorMessage += "Request timed out. Please try again.";
          break;
        default:
          errorMessage += "An unknown error occurred. Please try again.";
          break;
      }
      
      showAlert(errorMessage, ALERT_TYPES.ERROR);
      getLocationBtn.disabled = false;
      getLocationBtn.textContent = '📍';
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

/**
 * Shows an alert message with specified type
 * @param {string} message - Alert message to display
 * @param {string} type - Type of alert (success, error, warning)
 * @param {number} duration - Time in ms to show alert (0 for permanent)
 */
function showAlert(message, type = ALERT_TYPES.SUCCESS, duration = 5000) {
  // Clear any existing alert classes
  alert.className = 'p-3 rounded fade-in';
  
  // Add the appropriate alert class
  alert.classList.add(`alert-${type}`);
  
  // Set the message
  alertMessage.textContent = message;
  
  // Show the alert
  alert.classList.remove('hidden');
  
  // Hide after duration if specified
  if (duration > 0) {
    setTimeout(() => {
      alert.classList.add('fade-out');
      setTimeout(() => {
        alert.classList.add('hidden');
        alert.classList.remove('fade-out');
      }, 300);
    }, duration);
  }
}

/**
 * Upload media files to Firebase Storage
 * @param {string} emergencyId - Emergency report ID
 * @returns {Promise<string[]>} Array of download URLs
 */
async function uploadMedia(emergencyId) {
  if (!mediaFiles.length) return [];
  
  const downloadURLs = [];
  
  for (const file of mediaFiles) {
    const fileRef = storageRef(storage, `emergencies/${emergencyId}/${Date.now()}_${file.name}`);
    
    try {
      // Upload file
      const snapshot = await uploadBytes(fileRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      downloadURLs.push({
        url: downloadURL,
        type: file.type,
        name: file.name,
        size: file.size
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      // Continue with other files even if one fails
    }
  }
  
  return downloadURLs;
}

/**
 * Validates the form fields
 * @returns {boolean} Whether the form is valid
 */
function validateForm() {
  let isValid = true;
  
  // Validate emergency type
  if (!typeSelect.value) {
    typeError.classList.remove('hidden');
    isValid = false;
  } else {
    typeError.classList.add('hidden');
  }
  
  // Validate description (at least 10 chars)
  if (!descField.value || descField.value.trim().length < 10) {
    descError.textContent = descField.value ? 
      "Description must be at least 10 characters" : 
      "Please provide a description";
    descError.classList.remove('hidden');
    isValid = false;
  } else {
    descError.classList.add('hidden');
  }
  
  // Validate location
  if (!locationField.value) {
    locationError.classList.remove('hidden');
    isValid = false;
  } else {
    locationError.classList.add('hidden');
  }
  
  return isValid;
}

/**
 * Reset the form
 */
function resetForm() {
  form.reset();
  
  // Reset error messages
  typeError.classList.add('hidden');
  descError.classList.add('hidden');
  locationError.classList.add('hidden');
  
  // Clear media files
  mediaFiles = [];
  previewContainer.innerHTML = '';
  previewContainer.classList.add('hidden');
  
  // Reset safety tips
  safetyTips.classList.add('hidden');
  
  // Reset quick selection buttons
  quickEmergencyBtns.forEach(btn => btn.classList.remove('selected'));
  
  // Reset character count
  updateCharCount();
  
  // Show confirmation
  showAlert("Form has been cleared", ALERT_TYPES.WARNING, 3000);
}

/**
 * Handle form submission
 * @param {Event} e - Form submit event
 */
async function handleSubmit(e) {
  e.preventDefault();
  
  // Validate the form
  if (!validateForm()) {
    showAlert("Please fill all required fields correctly", ALERT_TYPES.ERROR);
    return;
  }
  
  // Show loading state
  loading.classList.remove('hidden');
  submitBtn.disabled = true;
  
  try {
    // Get location if consent given
    let locationData = null;
    
    if (currentPosition && locationConsent.checked) {
      locationData = {
        lat: currentPosition.coords.latitude,
        lng: currentPosition.coords.longitude,
        accuracy: currentPosition.coords.accuracy
      };
    } else if (locationConsent.checked) {
      try {
        // Try to get location from address using geocoding
        const address = locationField.value;
        const geocodeResult = await new Promise((resolve, reject) => {
          if (!geocoder) reject(new Error("Geocoder not available"));
          
          geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK' && results[0]) {
              resolve(results[0].geometry.location);
            } else {
              reject(new Error(`Geocoding failed: ${status}`));
            }
          });
        });
        
        locationData = {
          lat: geocodeResult.lat(),
          lng: geocodeResult.lng(),
          source: 'geocoded'
        };
      } catch (geocodeError) {
        console.error("Geocoding error:", geocodeError);
        // Continue without precise coordinates
      }
    }
    
    // Generate emergency ID
    const emergencyId = reportId.textContent;
    
    // Upload media files if any
    let mediaUrls = [];
    if (mediaFiles.length > 0) {
      try {
        mediaUrls = await uploadMedia(emergencyId);
      } catch (mediaError) {
        console.error("Media upload error:", mediaError);
        showAlert("Some media files couldn't be uploaded, but your report will still be submitted.", ALERT_TYPES.WARNING, 5000);
      }
    }
    
    // Prepare emergency data
    const emergency = {
      id: emergencyId,
      type: typeSelect.value,
      mainCategory: emergencyMainCategory || getMainCategory(typeSelect.value),
      location: {
        address: locationField.value,
        coordinates: locationData || "No precise location provided"
      },
      description: descField.value,
      severity: document.querySelector('input[name=severity]:checked').value,
      victims: parseInt(victimsInput.value) || 1,
      reportedBy: {
        name: document.getElementById('name').value || "Anonymous",
        contact: document.getElementById('contact').value || "Not provided"
      },
      media: mediaUrls,
      deviceInfo: {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        language: navigator.language
      },
      timestamp: serverTimestamp(),
      status: "New",
      isTest: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    };
    
    // Submit to Firebase
    await push(ref(db, 'incidents'), emergency);
    
    // Update modal content
    modalType.textContent = emergency.type;
    
    // Show success modal
    statusModal.classList.remove('hidden');
    statusModal.classList.add('fade-in');
    
    // Reset form
    resetForm();
    
  } catch (error) {
    console.error("Submission error:", error);
    showAlert(`❌ Error submitting report: ${error.message}`, ALERT_TYPES.ERROR);
  } finally {
    // Hide loading state
    loading.classList.add('hidden');
    submitBtn.disabled = false;
  }
}

/**
 * Get main category based on emergency type
 * @param {string} type - Detailed emergency type
 * @returns {string} Main category
 */
function getMainCategory(type) {
  if (type.includes('Fire') || type.includes('Explosion')) {
    return 'Fire';
  } else if (['Heart', 'Stroke', 'Breathing', 'Bleeding', 'Unconscious', 'Childbirth', 'Poisoning', 'Allergic'].some(term => type.includes(term))) {
    return 'Medical';
  } else if (['Car', 'Vehicle', 'Crash', 'Hit', 'Road', 'Traffic', 'Pedestrian'].some(term => type.includes(term))) {
    return 'Traffic';
  } else if (['Assault', 'Robbery', 'Break', 'Shooting', 'Violence', 'Suspicious'].some(term => type.includes(term))) {
    return 'Crime';
  } else if (['Flood', 'Earthquake', 'Landslide', 'Tornado', 'Hurricane', 'Weather'].some(term => type.includes(term))) {
    return 'Natural';
  }
  return 'Other';
}