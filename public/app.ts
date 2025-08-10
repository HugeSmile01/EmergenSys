interface EmergencyReport {
  id?: string;
  type: 'medical' | 'fire' | 'police';
  description: string;
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    manual?: string;
    timestamp: number;
  };
  contact?: {
    name?: string;
    phone?: string;
  };
  timestamp: number;
  status: 'submitted' | 'received' | 'dispatched' | 'resolved';
}

// Firebase configuration
const firebaseConfig = {
  // Your Firebase config
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

class EmergencySysApp {
  private currentStep: number = 1;
  private totalSteps: number = 3;
  private emergencyReport: EmergencyReport = {
    type: 'medical',
    description: '',
    timestamp: Date.now(),
    status: 'submitted'
  };
  private firestore: firebase.firestore.Firestore;
  private auth: firebase.auth.Auth;

  constructor() {
    // Initialize Firebase services
    this.firestore = firebase.firestore();
    this.auth = firebase.auth();
    
    // Initialize app
    this.initTheme();
    this.initEventListeners();
    this.signInAnonymously();
  }

  // Initialize dark/light theme
  private initTheme(): void {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark');
      this.updateThemeIcons(true);
    } else {
      this.updateThemeIcons(false);
    }
  }

  // Update theme icon visibility
  private updateThemeIcons(isDark: boolean): void {
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    
    if (sunIcon && moonIcon) {
      if (isDark) {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
      } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
      }
    }
  }

  // Toggle between light and dark themes
  private toggleTheme(): void {
    const isDark = document.body.classList.contains('dark');
    
    if (isDark) {
      document.body.classList.remove('dark');
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('darkMode', 'false');
    } else {
      document.body.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('darkMode', 'true');
    }
    
    this.updateThemeIcons(!isDark);
  }

  // Set up event listeners for interactive elements
  private initEventListeners(): void {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }
    
    // Navigation buttons
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const submitBtn = document.getElementById('submit-btn');
    
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.goToNextStep());
    }
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.goToPrevStep());
    }
    
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submitReport());
    }
    
    // Emergency type selection
    const typeButtons = document.querySelectorAll('.emergency-type-btn');
    typeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        // Remove active class from all buttons
        typeButtons.forEach(btn => btn.classList.remove('ring-2', 'ring-red-500'));
        
        // Add active class to clicked button
        (e.currentTarget as HTMLElement).classList.add('ring-2', 'ring-red-500');
        
        // Set emergency type
        const type = (e.currentTarget as HTMLElement).getAttribute('data-type') as EmergencyReport['type'];
        this.emergencyReport.type = type;
      });
    });
    
    // Location sharing
    const shareLocationCheckbox = document.getElementById('share-location') as HTMLInputElement;
    if (shareLocationCheckbox) {
      shareLocationCheckbox.addEventListener('change', () => {
        if (shareLocationCheckbox.checked) {
          this.requestLocationPermission();
        } else {
          this.clearLocationData();
          document.getElementById('manual-location-container')?.classList.add('hidden');
        }
      });
    }
    
    // Help panel
    const helpBtn = document.getElementById('help-btn');
    const closeHelpBtn = document.getElementById('close-help-btn');
    const helpBackdrop = document.getElementById('help-backdrop');
    
    if (helpBtn && closeHelpBtn && helpBackdrop) {
      helpBtn.addEventListener('click', () => {
        document.getElementById('help-panel')?.classList.remove('hidden');
      });
      
      closeHelpBtn.addEventListener('click', () => {
        document.getElementById('help-panel')?.classList.add('hidden');
      });
      
      helpBackdrop.addEventListener('click', () => {
        document.getElementById('help-panel')?.classList.add('hidden');
      });
    }
    
    // New report button
    const newReportBtn = document.getElementById('new-report-btn');
    if (newReportBtn) {
      newReportBtn.addEventListener('click', () => this.resetForm());
    }
  }
  
  // Sign in anonymously with Firebase
  private async signInAnonymously(): Promise<void> {
    try {
      await this.auth.signInAnonymously();
      console.log('Signed in anonymously');
    } catch (error) {
      console.error('Anonymous authentication error:', error);
    }
  }
  
  // Navigate to next step
  private goToNextStep(): void {
    // Validate current step
    if (!this.validateCurrentStep()) {
      return;
    }
    
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.updateUI();
    }
  }
  
  // Navigate to previous step
  private goToPrevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateUI();
    }
  }
  
  // Validate form data for current step
  private validateCurrentStep(): boolean {
    if (this.currentStep === 1) {
      // Emergency type - always valid as we preselect medical
      return true;
    } else if (this.currentStep === 2) {
      // Emergency details
      const description = (document.getElementById('emergency-description') as HTMLTextAreaElement).value.trim();
      if (!description) {
        this.showError('Please describe the emergency situation');
        return false;
      }
      
      // Save description
      this.emergencyReport.description = DOMPurify.sanitize(description);
      
      // Save manual location if provided
      const manualLocation = (document.getElementById('manual-location') as HTMLInputElement).value.trim();
      if (manualLocation) {
        this.emergencyReport.location = {
          ...this.emergencyReport.location,
          manual: DOMPurify.sanitize(manualLocation),
          timestamp: Date.now()
        };
      }
      
      return true;
    } else if (this.currentStep === 3) {
      // Contact information is optional
      const name = (document.getElementById('contact-name') as HTMLInputElement).value.trim();
      const phone = (document.getElementById('contact-phone') as HTMLInputElement).value.trim();
      
      if (name || phone) {
        this.emergencyReport.contact = {
          name: name ? DOMPurify.sanitize(name) : undefined,
          phone: phone ? DOMPurify.sanitize(phone) : undefined
        };
      }
      
      return true;
    }
    
    return true;
  }
  
  // Update UI to reflect current step
  private updateUI(): void {
    // Hide all steps
    document.querySelectorAll('.step-content').forEach(step => {
      (step as HTMLElement).classList.add('hidden');
    });
    
    // Show current step
    const currentStepElem = document.getElementById(`step-${this.currentStep}`);
    if (currentStepElem) {
      currentStepElem.classList.remove('hidden');
    }
    
    // Update progress
    const percentage = (this.currentStep / this.totalSteps) * 100;
    document.querySelector('.bg-red-600')?.setAttribute('style', `width: ${percentage}%`);
    
    // Update progress text
    const progressText = document.getElementById('progress-text');
    const progressPercentage = document.getElementById('progress-percentage');
    
    if (progressText && progressPercentage) {
      const stepTitles = ['Report Type', 'Emergency Details', 'Contact Information'];
      progressText.textContent = `Step ${this.currentStep} of ${this.totalSteps}: ${stepTitles[this.currentStep - 1]}`;
      progressPercentage.textContent = `${Math.round(percentage)}%`;
    }
    
    // Show/hide navigation buttons
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    
    if (prevBtn && nextBtn && submitBtn) {
      prevBtn.classList.toggle('hidden', this.currentStep === 1);
      nextBtn.classList.toggle('hidden', this.currentStep === this.totalSteps);
      submitBtn.classList.toggle('hidden', this.currentStep !== this.totalSteps);
    }
  }
  
  // Request user location permission
  private async requestLocationPermission(): void {
    const locationStatus = document.getElementById('location-status');
    const manualLocationContainer = document.getElementById('manual-location-container');
    
    if (locationStatus) {
      locationStatus.textContent = 'Requesting location access...';
      locationStatus.classList.remove('hidden');
    }
    
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser');
      }
      
      const position: GeolocationPosition = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      // Store location data
      this.emergencyReport.location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };
      
      if (locationStatus) {
        locationStatus.textContent = '✓ Location successfully detected';
        locationStatus.classList.remove('hidden');
        locationStatus.classList.add('text-green-600', 'dark:text-green-400');
      }
    } catch (error) {
      console.error('Location error:', error);
      
      if (locationStatus) {
        locationStatus.textContent = 'Could not access your location. You can enter it manually.';
        locationStatus.classList.remove('hidden');
        locationStatus.classList.add('text-red-600', 'dark:text-red-400');
      }
      
      if (manualLocationContainer) {
        manualLocationContainer.classList.remove('hidden');
      }
    }
  }
  
  // Clear location data
  private clearLocationData(): void {
    delete this.emergencyReport.location;
    
    const locationStatus = document.getElementById('location-status');
    if (locationStatus) {
      locationStatus.classList.add('hidden');
      locationStatus.classList.remove('text-green-600', 'dark:text-green-400', 'text-red-600', 'dark:text-red-400');
    }
  }
  
  // Submit emergency report
  private async submitReport(): void {
    // Validate current step
    if (!this.validateCurrentStep()) {
      return;
    }
    
    try {
      // Update timestamp to current time
      this.emergencyReport.timestamp = Date.now();
      
      // Submit to Firestore
      const docRef = await this.firestore.collection('emergencyReports').add(this.emergencyReport);
      
      // Update report ID
      this.emergencyReport.id = docRef.id;
      
      // Show success state
      document.querySelectorAll('.step-content').forEach(step => {
        (step as HTMLElement).classList.add('hidden');
      });
      
      const successState = document.getElementById('success-state');
      if (successState) {
        successState.classList.remove('hidden');
      }
      
      // Hide navigation buttons
      document.getElementById('prev-btn')?.classList.add('hidden');
      document.getElementById('next-btn')?.classList.add('hidden');
      document.getElementById('submit-btn')?.classList.add('hidden');
      
      // Update emergency ID
      const emergencyIdElem = document.getElementById('emergency-id');
      if (emergencyIdElem) {
        emergencyIdElem.textContent = docRef.id;
      }
      
    } catch (error) {
      console.error('Error submitting report:', error);
      this.showError('There was a problem submitting your report. Please try again.');
    }
  }
  
  // Reset form to start new report
  private resetForm(): void {
    // Reset report object
    this.emergencyReport = {
      type: 'medical',
      description: '',
      timestamp: Date.now(),
      status: 'submitted'
    };
    
    // Reset form fields
    (document.getElementById('emergency-description') as HTMLTextAreaElement).value = '';
    (document.getElementById('share-location') as HTMLInputElement).checked = false;
    (document.getElementById('manual-location') as HTMLInputElement).value = '';
    (document.getElementById('contact-name') as HTMLInputElement).value = '';
    (document.getElementById('contact-phone') as HTMLInputElement).value = '';
    
    // Reset to first step
    this.currentStep = 1;
    this.updateUI();
    
    // Clear any status messages
    this.clearLocationData();
    document.getElementById('manual-location-container')?.classList.add('hidden');
    
    // Reset emergency type selection
    document.querySelectorAll('.emergency-type-btn').forEach(btn => {
      btn.classList.remove('ring-2', 'ring-red-500');
    });
    
    // Select first option by default
    document.querySelector('.emergency-type-btn')?.classList.add('ring-2', 'ring-red-500');
  }
  
  // Show error message
  private showError(message: string): void {
    alert(message); // Replace with a nicer UI component in production
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new EmergencySysApp();
});