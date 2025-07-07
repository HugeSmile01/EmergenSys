/**
 * EmergenSys - Emergency Response Dashboard
 * Main JavaScript for the dashboard functionality
 * 
 * This file handles:
 * - Firebase integration for real-time data
 * - Google Maps integration for incident visualization
 * - Chart.js integration for analytics
 * - Dashboard UI interactions and management
 */

// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  onValue, 
  query, 
  orderByChild, 
  limitToLast, 
  update, 
  push, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { getStorage, ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

// Chart.js import
import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/+esm';
Chart.register(...registerables);

/**
 * Dashboard Configuration and Initialization
 */
const config = {
  // Map configuration
  map: {
    defaultCenter: { lat: 10.7749, lng: 122.5882 }, // Default center (Philippines)
    defaultZoom: 10,
    maxZoom: 18,
    minZoom: 3
  },
  // Pagination configuration
  pagination: {
    itemsPerPage: 10,
    currentPage: 1
  },
  // Status colors for incidents
  statusColors: {
    "New": "#dc2626", // Red
    "Pending": "#f59e0b", // Yellow
    "In Progress": "#3b82f6", // Blue
    "Resolved": "#10b981" // Green
  },
  // Chart colors
  chartColors: {
    fire: 'rgba(239, 68, 68, 0.8)',
    medical: 'rgba(59, 130, 246, 0.8)',
    crime: 'rgba(139, 92, 246, 0.8)',
    traffic: 'rgba(245, 158, 11, 0.8)',
    natural: 'rgba(16, 185, 129, 0.8)',
    other: 'rgba(156, 163, 175, 0.8)'
  },
  // Firebase configuration
  firebase: {
    apiKey: "AIzaSyC0gGIsNNRPXuGNx9xpuOEuCtJmh7Uvcsw",
    authDomain: "silago911.firebaseapp.com",
    projectId: "silago911",
    databaseURL: "https://silago911-default-rtdb.asia-southeast1.firebasedatabase.app",
    storageBucket: "silago911.appspot.com",
    messagingSenderId: "624672428258",
    appId: "1:624672428258:web:2c9038f5e789b34054cebb",
    measurementId: "G-QBZSJ9HH1Q"
  }
};

// State management
const state = {
  incidents: [],
  filteredIncidents: [],
  activeIncidents: [],
  teams: [],
  map: null,
  markers: [],
  charts: {},
  user: {
    name: "Response Personnel",
    email: "responder@silago911.org",
    role: "responder",
    initials: "RP"
  },
  filters: {
    status: "all",
    search: "",
  }
};

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', async () => {
  initializeFirebase();
  initializeUIElements();
  initializeEventListeners();
  checkDarkModePreference();
  updateLastUpdated();
  
  // Initialize maps when Google Maps API is loaded
  if (window.google && google.maps) {
    initializeMap();
  } else {
    window.initMap = initializeMap;
  }
  
  // Simulate loading
  showLoading();
  await fetchIncidents();
  updateDashboardUI();
  hideLoading();
});

/**
 * Initialize Firebase
 */
function initializeFirebase() {
  const app = initializeApp(config.firebase);
  state.db = getDatabase(app);
  state.storage = getStorage(app);
  
  // Subscribe to real-time updates for incidents
  const incidentsRef = ref(state.db, 'incidents');
  onValue(incidentsRef, (snapshot) => {
    const data = snapshot.val();
    state.incidents = data ? Object.entries(data).map(([id, incident]) => ({
      ...incident,
      fbId: id
    })) : [];
    
    // Update UI with new data
    updateDashboardUI();
  });
}

/**
 * Initialize UI elements
 */
function initializeUIElements() {
  // Set user information
  document.getElementById('userName').textContent = state.user.name;
  document.getElementById('userEmail').textContent = state.user.email;
  document.getElementById('userInitials').textContent = state.user.initials;
  
  // Initialize empty charts that will be populated later
  initializeCharts();
}

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
  // User dropdown toggle
  const userMenuButton = document.getElementById('user-menu-button');
  const userDropdown = document.getElementById('user-dropdown');
  
  userMenuButton.addEventListener('click', () => {
    userDropdown.classList.toggle('hidden');
  });
  
  // Close dropdown when clicking elsewhere
  document.addEventListener('click', (event) => {
    if (!userMenuButton.contains(event.target) && !userDropdown.contains(event.target)) {
      userDropdown.classList.add('hidden');
    }
  });
  
  // Dark mode toggle
  document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
  
  // Mobile sidebar toggle
  document.getElementById('toggleSidebarMobile').addEventListener('click', toggleSidebar);
  document.getElementById('sidebarBackdrop').addEventListener('click', closeSidebar);
  
  // Map controls
  document.getElementById('mapZoomIn').addEventListener('click', () => {
    if (state.map) state.map.setZoom(state.map.getZoom() + 1);
  });
  
  document.getElementById('mapZoomOut').addEventListener('click', () => {
    if (state.map) state.map.setZoom(state.map.getZoom() - 1);
  });
  
  document.getElementById('mapFullscreen').addEventListener('click', toggleMapFullscreen);
  
  // Incident filtering
  document.getElementById('incidentFilter').addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    updateActiveIncidentsList();
  });
  
  // Search functionality
  document.getElementById('searchIncidents').addEventListener('input', (e) => {
    state.filters.search = e.target.value.toLowerCase();
    updateDashboardUI();
  });
  
  // Refresh button
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    showLoading();
    await fetchIncidents();
    updateDashboardUI();
    updateLastUpdated();
    hideLoading();
  });
  
  // Pagination controls
  document.getElementById('prevPage').addEventListener('click', () => {
    if (config.pagination.currentPage > 1) {
      config.pagination.currentPage--;
      updateRecentIncidentsTable();
      updatePaginationControls();
    }
  });
  
  document.getElementById('nextPage').addEventListener('click', () => {
    const maxPage = Math.ceil(state.filteredIncidents.length / config.pagination.itemsPerPage);
    if (config.pagination.currentPage < maxPage) {
      config.pagination.currentPage++;
      updateRecentIncidentsTable();
      updatePaginationControls();
    }
  });
  
  // Export CSV
  document.getElementById('exportCsv').addEventListener('click', exportIncidentsToCSV);
  
  // Close incident modal
  document.getElementById('closeIncidentModal').addEventListener('click', () => {
    document.getElementById('incidentModal').classList.add('hidden');
  });
  
  // Status update in modal
  document.getElementById('modalUpdateStatus').addEventListener('change', (e) => {
    const incidentId = document.getElementById('modalIncidentId').getAttribute('data-id');
    const newStatus = e.target.value;
    if (incidentId && newStatus) {
      updateIncidentStatus(incidentId, newStatus);
    }
  });
  
  // Team assignment in modal
  document.getElementById('modalAssignTeam').addEventListener('change', (e) => {
    const incidentId = document.getElementById('modalIncidentId').getAttribute('data-id');
    const teamId = e.target.value;
    if (incidentId && teamId) {
      assignTeamToIncident(incidentId, teamId);
    }
  });
}

/**
 * Check and apply dark mode preference
 */
function checkDarkModePreference() {
  if (localStorage.getItem('darkMode') === 'enabled' || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches && 
       localStorage.getItem('darkMode') !== 'disabled')) {
    document.documentElement.classList.add('dark');
  }
}

/**
 * Toggle dark mode
 */
function toggleDarkMode() {
  if (document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('darkMode', 'disabled');
  } else {
    document.documentElement.classList.add('dark');
    localStorage.setItem('darkMode', 'enabled');
  }
  
  // Reinitialize charts with new theme
  updateChartsTheme();
  
  // Update map style if initialized
  if (state.map) {
    const isDarkMode = document.documentElement.classList.contains('dark');
    state.map.setOptions({
      styles: isDarkMode ? mapDarkStyle : []
    });
  }
}

/**
 * Toggle sidebar for mobile view
 */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  
  sidebar.classList.toggle('-translate-x-full');
  backdrop.classList.toggle('hidden');
}

/**
 * Close sidebar
 */
function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  
  sidebar.classList.add('-translate-x-full');
  backdrop.classList.add('hidden');
}

/**
 * Toggle map fullscreen
 */
function toggleMapFullscreen() {
  const mapContainer = document.getElementById('map').parentElement;
  
  if (mapContainer.classList.contains('fixed')) {
    // Exit fullscreen
    mapContainer.classList.remove('fixed', 'inset-0', 'z-40', 'p-4');
    document.body.classList.remove('overflow-hidden');
  } else {
    // Enter fullscreen
    mapContainer.classList.add('fixed', 'inset-0', 'z-40', 'p-4');
    document.body.classList.add('overflow-hidden');
  }
  
  // Trigger resize event for map
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 100);
}

/**
 * Initialize Google Maps
 */
function initializeMap() {
  // Create the map instance
  state.map = new google.maps.Map(document.getElementById('map'), {
    center: config.map.defaultCenter,
    zoom: config.map.defaultZoom,
    maxZoom: config.map.maxZoom,
    minZoom: config.map.minZoom,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: document.documentElement.classList.contains('dark') ? mapDarkStyle : []
  });
  
  // Initialize geocoder
  state.geocoder = new google.maps.Geocoder();
  
  // Create info window for markers
  state.infoWindow = new google.maps.InfoWindow();
  
  // Update map with incidents
  updateMapMarkers();
}

/**
 * Update map markers based on incidents
 */
function updateMapMarkers() {
  // Clear existing markers
  state.markers.forEach(marker => marker.setMap(null));
  state.markers = [];
  
  if (!state.map) return;
  
  // Add markers for each incident with location data
  state.incidents.forEach(incident => {
    if (incident.location && incident.location.coordinates && 
        incident.location.coordinates.lat && incident.location.coordinates.lng) {
      
      const position = {
        lat: incident.location.coordinates.lat,
        lng: incident.location.coordinates.lng
      };
      
      // Create marker
      const marker = new google.maps.Marker({
        position,
        map: state.map,
        title: incident.type || 'Incident',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: config.statusColors[incident.status] || config.statusColors.New,
          fillOpacity: 0.9,
          strokeWeight: 1,
          strokeColor: '#ffffff'
        },
        animation: google.maps.Animation.DROP
      });
      
      // Add click listener to show info window
      marker.addListener('click', () => {
        const contentString = `
          <div class="p-2">
            <h3 class="font-semibold">${incident.type || 'Unknown Incident'}</h3>
            <p class="text-sm">${incident.location.address || 'No address'}</p>
            <p class="text-xs mt-1">Status: <span class="font-medium">${incident.status || 'Unknown'}</span></p>
            <button class="text-xs text-emergen-red hover:underline mt-1 view-details" data-id="${incident.fbId}">
              View Details
            </button>
          </div>
        `;
        
        state.infoWindow.setContent(contentString);
        state.infoWindow.open(state.map, marker);
        
        // Add event listener to "View Details" button after infoWindow is populated
        setTimeout(() => {
          const viewDetailsButtons = document.querySelectorAll('.view-details');
          viewDetailsButtons.forEach(button => {
            button.addEventListener('click', () => {
              const incidentId = button.getAttribute('data-id');
              openIncidentModal(incidentId);
            });
          });
        }, 100);
      });
      
      state.markers.push(marker);
    }
  });
  
  // Adjust map bounds to fit all markers if there are any
  if (state.markers.length > 0) {
    const bounds = new google.maps.LatLngBounds();
    state.markers.forEach(marker => bounds.extend(marker.getPosition()));
    state.map.fitBounds(bounds);
    
    // Don't zoom in too far for a single marker
    if (state.map.getZoom() > 15) state.map.setZoom(15);
  }
}

/**
 * Initialize all charts
 */
function initializeCharts() {
  const isDarkMode = document.documentElement.classList.contains('dark');
  const textColor = isDarkMode ? '#e5e7eb' : '#4b5563';
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  
  // Common options for all charts
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: textColor,
          boxWidth: 12,
          padding: 10,
          font: {
            size: 10
          }
        }
      },
      tooltip: {
        backgroundColor: isDarkMode ? '#374151' : 'white',
        titleColor: isDarkMode ? '#e5e7eb' : '#111827',
        bodyColor: isDarkMode ? '#d1d5db' : '#4b5563',
        borderColor: isDarkMode ? '#4b5563' : '#e5e7eb',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: {
          color: textColor,
          font: {
            size: 10
          }
        },
        grid: {
          color: gridColor
        }
      },
      y: {
        ticks: {
          color: textColor,
          font: {
            size: 10
          }
        },
        grid: {
          color: gridColor
        }
      }
    }
  };
  
  // Incidents by Type chart (Doughnut)
  const incidentsByTypeCtx = document.getElementById('incidentsByTypeChart').getContext('2d');
  state.charts.incidentsByType = new Chart(incidentsByTypeCtx, {
    type: 'doughnut',
    data: {
      labels: ['Fire', 'Medical', 'Crime', 'Traffic', 'Natural', 'Other'],
      datasets: [{
        data: [0, 0, 0, 0, 0, 0],
        backgroundColor: [
          config.chartColors.fire,
          config.chartColors.medical,
          config.chartColors.crime,
          config.chartColors.traffic,
          config.chartColors.natural,
          config.chartColors.other
        ]
      }]
    },
    options: {
      ...commonOptions,
      cutout: '65%'
    }
  });
  
  // Incidents by Time chart (Line)
  const incidentsByTimeCtx = document.getElementById('incidentsByTimeChart').getContext('2d');
  state.charts.incidentsByTime = new Chart(incidentsByTimeCtx, {
    type: 'line',
    data: {
      labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
      datasets: [{
        label: 'Incidents',
        data: [0, 0, 0, 0, 0, 0, 0, 0],
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: commonOptions
  });
  
  // Response Time chart (Bar)
  const responseTimeCtx = document.getElementById('responseTimeChart').getContext('2d');
  state.charts.responseTime = new Chart(responseTimeCtx, {
    type: 'bar',
    data: {
      labels: ['Fire', 'Medical', 'Crime', 'Traffic', 'Natural', 'Other'],
      datasets: [{
        label: 'Average Response Time (minutes)',
        data: [0, 0, 0, 0, 0, 0],
        backgroundColor: [
          config.chartColors.fire,
          config.chartColors.medical,
          config.chartColors.crime,
          config.chartColors.traffic,
          config.chartColors.natural,
          config.chartColors.other
        ]
      }]
    },
    options: commonOptions
  });
  
  // Severity Distribution chart (Pie)
  const severityCtx = document.getElementById('severityChart').getContext('2d');
  state.charts.severity = new Chart(severityCtx, {
    type: 'pie',
    data: {
      labels: ['Low', 'Medium', 'High'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: ['#fbbf24', '#fb923c', '#dc2626']
      }]
    },
    options: commonOptions
  });
}

/**
 * Update chart themes based on dark mode
 */
function updateChartsTheme() {
  // Destroy existing charts
  for (const chartKey in state.charts) {
    if (state.charts[chartKey]) {
      state.charts[chartKey].destroy();
    }
  }
  
  // Reinitialize charts with updated theme
  initializeCharts();
  
  // Update chart data
  updateCharts();
}

/**
 * Update all charts with current data
 */
function updateCharts() {
  if (!state.incidents || state.incidents.length === 0) return;
  
  // Calculate data for all charts
  const incidentsByType = {
    Fire: 0,
    Medical: 0,
    Crime: 0,
    Traffic: 0,
    Natural: 0,
    Other: 0
  };
  
  const severityDistribution = {
    Low: 0,
    Medium: 0,
    High: 0
  };
  
  const incidentsByHour = Array(8).fill(0);
  
  const responseTimesByType = {
    Fire: [],
    Medical: [],
    Crime: [],
    Traffic: [],
    Natural: [],
    Other: []
  };
  
  // Process incidents to gather analytics data
  state.incidents.forEach(incident => {
    // Incidents by type
    const type = getMainCategoryFromType(incident.type);
    if (incidentsByType.hasOwnProperty(type)) {
      incidentsByType[type]++;
    } else {
      incidentsByType.Other++;
    }
    
    // Severity distribution
    if (severityDistribution.hasOwnProperty(incident.severity)) {
      severityDistribution[incident.severity]++;
    }
    
    // Incidents by hour
    if (incident.timestamp) {
      const date = new Date(incident.timestamp);
      const hour = date.getHours();
      const hourIndex = Math.floor(hour / 3);
      if (hourIndex >= 0 && hourIndex < incidentsByHour.length) {
        incidentsByHour[hourIndex]++;
      }
    }
    
    // Response times
    if (incident.responseTime) {
      const category = getMainCategoryFromType(incident.type);
      if (responseTimesByType.hasOwnProperty(category)) {
        responseTimesByType[category].push(incident.responseTime);
      }
    }
  });
  
  // Calculate average response times
  const avgResponseTimes = Object.keys(responseTimesByType).map(type => {
    const times = responseTimesByType[type];
    if (times.length === 0) return 0;
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  });
  
  // Update Incidents by Type chart
  state.charts.incidentsByType.data.datasets[0].data = Object.values(incidentsByType);
  state.charts.incidentsByType.update();
  
  // Update Incidents by Time chart
  state.charts.incidentsByTime.data.datasets[0].data = incidentsByHour;
  state.charts.incidentsByTime.update();
  
  // Update Response Time chart
  state.charts.responseTime.data.datasets[0].data = avgResponseTimes;
  state.charts.responseTime.update();
  
  // Update Severity Distribution chart
  state.charts.severity.data.datasets[0].data = Object.values(severityDistribution);
  state.charts.severity.update();
}

/**
 * Determine the main category from incident type
 * @param {string} type - Detailed incident type
 * @returns {string} - Main category
 */
function getMainCategoryFromType(type) {
  if (!type) return 'Other';
  
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

/**
 * Fetch incidents from Firebase
 */
async function fetchIncidents() {
  try {
    // Incidents are already being fetched in real-time by the onValue listener
    // This function could be used to refresh data manually or fetch additional data
    console.log("Refreshing incidents data...");
    
    // Simulate some async operation that might happen here
    return new Promise(resolve => {
      setTimeout(resolve, 500);
    });
  } catch (error) {
    console.error("Error fetching incidents:", error);
  }
}

/**
 * Update the last updated timestamp
 */
function updateLastUpdated() {
  const now = new Date();
  document.getElementById('lastUpdated').textContent = formatDateTime(now);
}

/**
 * Format date and time in YYYY-MM-DD HH:MM:SS format
 * @param {Date} date - Date object to format
 * @returns {string} - Formatted date string
 */
function formatDateTime(date) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Show loading state
 */
function showLoading() {
  // Implement loading indicators as needed
  document.getElementById('refresh-btn').classList.add('animate-spin');
}

/**
 * Hide loading state
 */
function hideLoading() {
  document.getElementById('refresh-btn').classList.remove('animate-spin');
}

/**
 * Update all dashboard UI elements with current data
 */
function updateDashboardUI() {
  // Filter incidents based on search term
  applyFilters();
  
  // Update stats
  updateStatistics();
  
  // Update active incidents list
  updateActiveIncidentsList();
  
  // Update recent incidents table
  updateRecentIncidentsTable();
  
  // Update pagination controls
  updatePaginationControls();
  
  // Update map markers
  updateMapMarkers();
  
  // Update charts
  updateCharts();
}

/**
 * Apply filters to incidents
 */
function applyFilters() {
  state.filteredIncidents = [...state.incidents];
  
  // Apply search filter if there's a search term
  if (state.filters.search) {
    state.filteredIncidents = state.filteredIncidents.filter(incident => {
      const searchTerm = state.filters.search.toLowerCase();
      return (
        (incident.type && incident.type.toLowerCase().includes(searchTerm)) ||
        (incident.description && incident.description.toLowerCase().includes(searchTerm)) ||
        (incident.location && incident.location.address && incident.location.address.toLowerCase().includes(searchTerm)) ||
        (incident.id && incident.id.toLowerCase().includes(searchTerm)) ||
        (incident.reportedBy && incident.reportedBy.name && incident.reportedBy.name.toLowerCase().includes(searchTerm))
      );
    });
  }
  
  // Get active incidents (not resolved)
  state.activeIncidents = state.filteredIncidents.filter(
    incident => incident.status !== 'Resolved'
  );
  
  // Further filter active incidents based on status filter
  if (state.filters.status !== 'all') {
    state.activeIncidents = state.activeIncidents.filter(
      incident => incident.status === capitalizeFirstLetter(state.filters.status)
    );
  }
  
  // Sort incidents by timestamp (newest first)
  state.filteredIncidents.sort((a, b) => {
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
  
  state.activeIncidents.sort((a, b) => {
    // Sort by status priority (New > Pending > In Progress)
    const statusPriority = {
      'New': 3,
      'Pending': 2,
      'In Progress': 1,
      'Resolved': 0
    };
    
    const priorityDiff = (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0);
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then sort by timestamp
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
}

/**
 * Update dashboard statistics
 */
function updateStatistics() {
  const totalIncidents = state.incidents.length;
  const newIncidents = state.incidents.filter(i => i.status === 'New').length;
  const pendingIncidents = state.incidents.filter(i => i.status === 'Pending').length;
  const inProgressIncidents = state.incidents.filter(i => i.status === 'In Progress').length;
  const resolvedIncidents = state.incidents.filter(i => i.status === 'Resolved').length;
  
  // Update counters
  document.getElementById('totalIncidents').textContent = totalIncidents;
  document.getElementById('activeCount').textContent = state.activeIncidents.length;
  document.getElementById('pendingIncidents').textContent = pendingIncidents;
  document.getElementById('inProgressIncidents').textContent = inProgressIncidents;
  document.getElementById('resolvedIncidents').textContent = resolvedIncidents;
  
  // Calculate percentages
  const pendingPercentage = totalIncidents ? Math.round((pendingIncidents / totalIncidents) * 100) : 0;
  const inProgressPercentage = totalIncidents ? Math.round((inProgressIncidents / totalIncidents) * 100) : 0;
  const resolvedPercentage = totalIncidents ? Math.round((resolvedIncidents / totalIncidents) * 100) : 0;
  
  // Update progress bars
  document.getElementById('pendingProgressBar').style.width = `${pendingPercentage}%`;
  document.getElementById('inProgressProgressBar').style.width = `${inProgressPercentage}%`;
  document.getElementById('resolvedProgressBar').style.width = `${resolvedPercentage}%`;
  
  // Update percentage labels
  document.getElementById('pendingPercentage').textContent = `${pendingPercentage}%`;
  document.getElementById('inProgressPercentage').textContent = `${inProgressPercentage}%`;
  document.getElementById('resolvedPercentage').textContent = `${resolvedPercentage}%`;
  
  // Update trend (fake data for demonstration)
  const trend = Math.floor(Math.random() * 30) - 10;
  const trendElement = document.getElementById('incidentTrend');
  trendElement.textContent = `${Math.abs(trend)}% ${trend >= 0 ? 'increase' : 'decrease'} from yesterday`;
  trendElement.className = trend >= 0 ? 'text-xs text-red-500 dark:text-red-400' : 'text-xs text-green-500 dark:text-green-400';
  
  if (trend >= 0) {
    trendElement.innerHTML = `
      <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clip-rule="evenodd"></path>
      </svg>
      ${Math.abs(trend)}% from yesterday
    `;
  } else {
    trendElement.innerHTML = `
      <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414l4.293 4.293a1 1 0 001.414 0z" clip-rule="evenodd"></path>
      </svg>
      ${Math.abs(trend)}% from yesterday
    `;
  }
}

/**
 * Update active incidents list
 */
function updateActiveIncidentsList() {
  const listContainer = document.getElementById('activeIncidentsList');
  
  if (state.activeIncidents.length === 0) {
    listContainer.innerHTML = `
      <div class="p-4 text-center text-gray-500 dark:text-gray-400">
        <svg class="mx-auto mb-2 w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p>No active incidents matching your filter</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  
  // Show up to 10 active incidents
  state.activeIncidents.slice(0, 10).forEach(incident => {
    const statusColor = config.statusColors[incident.status] || config.statusColors.New;
    const timestamp = incident.timestamp ? new Date(incident.timestamp).toLocaleTimeString() : 'Unknown';
    
    html += `
      <div class="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors" 
           onclick="window.openIncidentModal('${incident.fbId}')">
        <div class="flex items-start">
          <div class="inline-block relative">
            <div class="w-2 h-2 rounded-full absolute -top-1 -right-1 ${getStatusClass(incident.status)}"></div>
            <div class="w-8 h-8 rounded-full bg-opacity-20 flex items-center justify-center ${getIconBgClass(incident.type)}">
              ${getEmergencyIcon(incident.type)}
            </div>
          </div>
          <div class="ml-3 flex-grow min-w-0">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white truncate">
                ${incident.type || 'Unknown Emergency'}
              </h3>
              <span class="text-xs text-gray-500 dark:text-gray-400">${timestamp}</span>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
              ${incident.location?.address || 'Location unknown'}
            </p>
            <div class="flex items-center mt-1">
              <span class="px-1.5 py-0.5 text-xs rounded-full" 
                    style="color: ${statusColor}; background-color: ${statusColor}20;">
                ${incident.status || 'New'}
              </span>
              ${incident.severity ? 
                `<span class="ml-2 px-1.5 py-0.5 text-xs text-white rounded-full bg-opacity-90 ${getSeverityClass(incident.severity)}">
                  ${incident.severity}
                </span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  });
  
  listContainer.innerHTML = html;
}

/**
 * Update recent incidents table
 */
function updateRecentIncidentsTable() {
  const tableBody = document.getElementById('recentIncidentsTable');
  
  if (state.filteredIncidents.length === 0) {
    tableBody.innerHTML = `
      <tr class="border-b dark:border-gray-700">
        <td colspan="7" class="px-4 py-5 text-center text-gray-500 dark:text-gray-400">
          No incidents found matching your search criteria
        </td>
      </tr>
    `;
    return;
  }
  
  // Calculate pagination
  const startIndex = (config.pagination.currentPage - 1) * config.pagination.itemsPerPage;
  const endIndex = startIndex + config.pagination.itemsPerPage;
  const paginatedIncidents = state.filteredIncidents.slice(startIndex, endIndex);
  
  let html = '';
  
  paginatedIncidents.forEach(incident => {
    const timestamp = incident.timestamp ? formatDateTime(new Date(incident.timestamp)) : 'Unknown';
    const statusClass = getStatusBadgeClass(incident.status);
    const severityClass = getSeverityBadgeClass(incident.severity);
    
    html += `
      <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
        <td class="px-4 py-3 font-mono text-xs">
          ${incident.id || 'N/A'}
        </td>
        <td class="px-4 py-3">
          ${incident.type || 'Unknown'}
        </td>
        <td class="px-4 py-3 max-w-xs truncate">
          ${incident.location?.address || 'Unknown location'}
        </td>
        <td class="px-4 py-3">
          <span class="${severityClass}">
            ${incident.severity || 'Unknown'}
          </span>
        </td>
        <td class="px-4 py-3">
          <span class="${statusClass}">
            ${incident.status || 'New'}
          </span>
        </td>
        <td class="px-4 py-3 text-xs">
          ${timestamp}
        </td>
        <td class="px-4 py-3">
          <button onclick="window.openIncidentModal('${incident.fbId}')" class="text-xs font-medium text-blue-600 dark:text-blue-500 hover:underline">Details</button>
        </td>
      </tr>
    `;
  });
  
  tableBody.innerHTML = html;
  
  // Update counts
  document.getElementById('currentCount').textContent = paginatedIncidents.length;
  document.getElementById('totalCount').textContent = state.filteredIncidents.length;
}

/**
 * Update pagination controls
 */
function updatePaginationControls() {
  const totalPages = Math.ceil(state.filteredIncidents.length / config.pagination.itemsPerPage);
  const currentPage = config.pagination.currentPage;
  
  document.getElementById('prevPage').disabled = currentPage <= 1;
  document.getElementById('nextPage').disabled = currentPage >= totalPages;
}

/**
 * Export incidents to CSV
 */
function exportIncidentsToCSV() {
  if (state.incidents.length === 0) {
    alert('No data to export');
    return;
  }
  
  // Define CSV headers
  const headers = [
    'ID',
    'Type',
    'Description',
    'Location',
    'Severity',
    'Status',
    'Reported By',
    'Contact',
    'Timestamp'
  ];
  
  // Convert incidents to CSV rows
  const rows = state.incidents.map(incident => {
    const timestamp = incident.timestamp ? formatDateTime(new Date(incident.timestamp)) : '';
    
    return [
      incident.id || '',
      incident.type || '',
      (incident.description || '').replace(/,/g, ';').replace(/\n/g, ' '), // Replace commas and newlines
      incident.location?.address || '',
      incident.severity || '',
      incident.status || '',
      incident.reportedBy?.name || '',
      incident.reportedBy?.contact || '',
      timestamp
    ];
  });
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  link.setAttribute('href', url);
  link.setAttribute('download', `incidents-export-${timestamp}.csv`);
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Open incident detail modal
 * @param {string} incidentId - Firebase incident ID
 */
function openIncidentModal(incidentId) {
  const incident = state.incidents.find(inc => inc.fbId === incidentId);
  if (!incident) return;
  
  // Populate modal with incident data
  document.getElementById('modalIncidentType').textContent = incident.type || 'Unknown';
  document.getElementById('modalIncidentId').textContent = incident.id || 'N/A';
  document.getElementById('modalIncidentId').setAttribute('data-id', incident.fbId);
  
  const statusEl = document.getElementById('modalIncidentStatus');
  statusEl.textContent = incident.status || 'New';
  statusEl.className = `px-2.5 py-1 text-xs font-medium text-center text-white rounded-full mr-2 ${getStatusBgClass(incident.status)}`;
  
  const severityEl = document.getElementById('modalIncidentSeverity');
  severityEl.textContent = `${incident.severity || 'Unknown'} Severity`;
  severityEl.className = `px-2.5 py-1 text-xs font-medium text-center text-white rounded-full ${getSeverityBgClass(incident.severity)}`;
  
  document.getElementById('modalIncidentDesc').textContent = incident.description || 'No description provided';
  document.getElementById('modalIncidentLocation').textContent = incident.location?.address || 'Location unknown';
  document.getElementById('modalReportedTime').textContent = incident.timestamp ? formatDateTime(new Date(incident.timestamp)) : 'Unknown';
  document.getElementById('modalReporterName').textContent = incident.reportedBy?.name || 'Anonymous';
  document.getElementById('modalReporterContact').textContent = incident.reportedBy?.contact || 'No contact provided';
  document.getElementById('modalVictimCount').textContent = `${incident.victims || 1} ${(incident.victims || 1) === 1 ? 'person' : 'people'}`;
  
  // Set select values
  const statusSelect = document.getElementById('modalUpdateStatus');
  statusSelect.value = incident.status || '';
  
  const teamSelect = document.getElementById('modalAssignTeam');
  teamSelect.value = incident.assignedTeam || '';
  
  // Show modal
  document.getElementById('incidentModal').classList.remove('hidden');
  
  // Initialize modal map if coordinates are available
  if (incident.location?.coordinates && window.google && google.maps) {
    setTimeout(() => {
      initializeModalMap(incident.location.coordinates);
    }, 300);
  }
  
  // Load media if available
  if (incident.media && incident.media.length > 0) {
    loadIncidentMedia(incident.media);
  } else {
    document.getElementById('modalIncidentMedia').innerHTML = `
      <div class="bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center h-24">
        <span class="text-gray-400 dark:text-gray-500">No media available</span>
      </div>
    `;
  }
  
  // Generate timeline
  generateIncidentTimeline(incident);
}

/**
 * Initialize map in the incident modal
 * @param {object} coordinates - Lat/lng coordinates
 */
function initializeModalMap(coordinates) {
  const modalMapEl = document.getElementById('modalIncidentMap');
  
  const position = {
    lat: coordinates.lat,
    lng: coordinates.lng
  };
  
  const map = new google.maps.Map(modalMapEl, {
    center: position,
    zoom: 15,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: true,
    styles: document.documentElement.classList.contains('dark') ? mapDarkStyle : []
  });
  
  // Add marker
  new google.maps.Marker({
    position,
    map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: '#dc2626',
      fillOpacity: 0.7,
      strokeWeight: 2,
      strokeColor: '#ffffff'
    }
  });
}

/**
 * Generate incident timeline entries
 * @param {object} incident - Incident data
 */
function generateIncidentTimeline(incident) {
  const timelineContainer = document.getElementById('modalTimeline');
  const entries = [];
  
  // Add status changes to timeline
  if (incident.statusUpdates) {
    Object.entries(incident.statusUpdates).forEach(([timestamp, status]) => {
      entries.push({
        time: parseInt(timestamp),
        status,
        type: 'status'
      });
    });
  }
  
  // Add team assignments to timeline
  if (incident.teamAssignments) {
    Object.entries(incident.teamAssignments).forEach(([timestamp, team]) => {
      entries.push({
        time: parseInt(timestamp),
        team,
        type: 'team'
      });
    });
  }
  
  // Add notes/comments to timeline
  if (incident.notes) {
    Object.entries(incident.notes).forEach(([id, note]) => {
      entries.push({
        time: note.timestamp,
        note: note.text,
        author: note.author,
        type: 'note'
      });
    });
  }
  
  // Sort entries by time (newest first)
  entries.sort((a, b) => b.time - a.time);
  
  // If no entries, add placeholder status
  if (entries.length === 0) {
    timelineContainer.innerHTML = `
      <div class="flex">
        <div class="flex flex-col items-center mr-4">
          <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <div class="h-full w-0.5 bg-gray-200 dark:bg-gray-600"></div>
        </div>
        <div class="pb-5">
          <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateTime(new Date())}</p>
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Status: ${incident.status || 'New'}</p>
        </div>
      </div>
    `;
    return;
  }
  
  // Generate timeline HTML
  let html = '';
  
  entries.forEach((entry, index) => {
    const date = new Date(entry.time);
    const timeStr = formatDateTime(date);
    let content = '';
    let dotColor = 'bg-blue-500';
    
    if (entry.type === 'status') {
      dotColor = getStatusDotClass(entry.status);
      content = `<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Status changed to <span class="font-semibold">${entry.status}</span></p>`;
    } else if (entry.type === 'team') {
      dotColor = 'bg-purple-500';
      content = `<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned to <span class="font-semibold">${entry.team}</span></p>`;
    } else if (entry.type === 'note') {
      dotColor = 'bg-emergen-red';
      content = `
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Note by ${entry.author || 'System'}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${entry.note}</p>
      `;
    }
    
    const isLast = index === entries.length - 1;
    
    html += `
      <div class="flex">
        <div class="flex flex-col items-center mr-4">
          <div class="w-2 h-2 ${dotColor} rounded-full"></div>
          <div class="h-full w-0.5 bg-gray-200 dark:bg-gray-600 ${isLast ? 'hidden' : ''}"></div>
        </div>
        <div class="pb-5">
          <p class="text-xs text-gray-500 dark:text-gray-400">${timeStr}</p>
          ${content}
        </div>
      </div>
    `;
  });
  
  timelineContainer.innerHTML = html;
}

/**
 * Load incident media in the modal
 * @param {array} mediaItems - Array of media objects
 */
function loadIncidentMedia(mediaItems) {
  const mediaContainer = document.getElementById('modalIncidentMedia');
  let html = '';
  
  mediaItems.forEach(media => {
    if (media.type && media.type.startsWith('image/')) {
      html += `
        <div class="relative rounded-lg overflow-hidden h-24">
          <img src="${media.url}" alt="Incident media" class="w-full h-full object-cover">
        </div>
      `;
    } else if (media.type && media.type.startsWith('video/')) {
      html += `
        <div class="relative rounded-lg overflow-hidden h-24">
          <video src="${media.url}" class="w-full h-full object-cover"></video>
          <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center h-24">
          <span class="text-gray-400 dark:text-gray-500">File: ${media.name || 'Unknown'}</span>
        </div>
      `;
    }
  });
  
  mediaContainer.innerHTML = html;
}

/**
 * Update incident status
 * @param {string} incidentId - Firebase incident ID
 * @param {string} newStatus - New status value
 */
function updateIncidentStatus(incidentId, newStatus) {
  // Get reference to this incident
  const incidentRef = ref(state.db, `incidents/${incidentId}`);
  
  // Update status
  update(incidentRef, {
    status: newStatus,
    [`statusUpdates/${Date.now()}`]: newStatus
  })
    .then(() => {
      console.log(`Status updated to ${newStatus}`);
      
      // Update timeline in modal
      const incident = state.incidents.find(inc => inc.fbId === incidentId);
      if (incident) {
        incident.status = newStatus;
        if (!incident.statusUpdates) incident.statusUpdates = {};
        incident.statusUpdates[Date.now()] = newStatus;
        generateIncidentTimeline(incident);
      }
      
      // Update status badge in modal
      const statusEl = document.getElementById('modalIncidentStatus');
      statusEl.textContent = newStatus;
      statusEl.className = `px-2.5 py-1 text-xs font-medium text-center text-white rounded-full mr-2 ${getStatusBgClass(newStatus)}`;
    })
    .catch(error => {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    });
}

/**
 * Assign team to incident
 * @param {string} incidentId - Firebase incident ID
 * @param {string} teamId - Team ID
 */
function assignTeamToIncident(incidentId, teamId) {
  // Get team name
  const teamName = document.getElementById('modalAssignTeam').options[
    document.getElementById('modalAssignTeam').selectedIndex
  ].text;
  
  // Get reference to this incident
  const incidentRef = ref(state.db, `incidents/${incidentId}`);
  
  // Update team assignment
  update(incidentRef, {
    assignedTeam: teamId,
    assignedTeamName: teamName,
    [`teamAssignments/${Date.now()}`]: teamName
  })
    .then(() => {
      console.log(`Team assigned: ${teamName}`);
      
      // Update timeline in modal
      const incident = state.incidents.find(inc => inc.fbId === incidentId);
      if (incident) {
        incident.assignedTeam = teamId;
        incident.assignedTeamName = teamName;
        if (!incident.teamAssignments) incident.teamAssignments = {};
        incident.teamAssignments[Date.now()] = teamName;
        generateIncidentTimeline(incident);
      }
    })
    .catch(error => {
      console.error("Error assigning team:", error);
      alert("Failed to assign team. Please try again.");
    });
}

/**
 * Utility Functions
 */

/**
 * Capitalize first letter of a string
 * @param {string} string - Input string
 * @returns {string} - String with first letter capitalized
 */
function capitalizeFirstLetter(string) {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Get status dot class based on status
 * @param {string} status - Status value
 * @returns {string} - CSS class for dot
 */
function getStatusDotClass(status) {
  switch (status) {
    case 'New':
      return 'bg-emergen-red';
    case 'Pending':
      return 'bg-yellow-500';
    case 'In Progress':
      return 'bg-blue-500';
    case 'Resolved':
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Get status badge class based on status
 * @param {string} status - Status value
 * @returns {string} - CSS classes for badge
 */
function getStatusBadgeClass(status) {
  switch (status) {
    case 'New':
      return 'px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'Pending':
      return 'px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'In Progress':
      return 'px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'Resolved':
      return 'px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    default:
      return 'px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

/**
 * Get status background class based on status
 * @param {string} status - Status value
 * @returns {string} - CSS class for background
 */
function getStatusBgClass(status) {
  switch (status) {
    case 'New':
      return 'bg-red-500';
    case 'Pending':
      return 'bg-yellow-500';
    case 'In Progress':
      return 'bg-blue-500';
    case 'Resolved':
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Get severity badge class based on severity
 * @param {string} severity - Severity value
 * @returns {string} - CSS classes for badge
 */
function getSeverityBadgeClass(severity) {
  switch (severity) {
    case 'High':
      return 'px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'Medium':
      return 'px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'Low':
      return 'px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    default:
      return 'px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

/**
 * Get severity background class based on severity
 * @param {string} severity - Severity value
 * @returns {string} - CSS class for background
 */
function getSeverityBgClass(severity) {
  switch (severity) {
    case 'High':
      return 'bg-red-500';
    case 'Medium':
      return 'bg-orange-500';
    case 'Low':
      return 'bg-yellow-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Get status class for indicator dots
 * @param {string} status - Status value
 * @returns {string} - CSS class
 */
function getStatusClass(status) {
  switch (status) {
    case 'New':
      return 'bg-red-500 animate-pulse';
    case 'Pending':
      return 'bg-yellow-500';
    case 'In Progress':
      return 'bg-blue-500';
    case 'Resolved':
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Get icon background class based on emergency type
 * @param {string} type - Emergency type
 * @returns {string} - CSS classes
 */
function getIconBgClass(type) {
  const category = getMainCategoryFromType(type);
  switch (category) {
    case 'Fire':
      return 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300';
    case 'Medical':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300';
    case 'Crime':
      return 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300';
    case 'Traffic':
      return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300';
    case 'Natural':
      return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

/**
 * Get emergency icon based on type
 * @param {string} type - Emergency type
 * @returns {string} - Icon HTML
 */
function getEmergencyIcon(type) {
  const category = getMainCategoryFromType(type);
  switch (category) {
    case 'Fire':
      return '🔥';
    case 'Medical':
      return '🚑';
    case 'Crime':
      return '🚨';
    case 'Traffic':
      return '🚗';
    case 'Natural':
      return '🌪️';
    default:
      return '❓';
  }
}

// Dark style for Google Maps
const mapDarkStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.