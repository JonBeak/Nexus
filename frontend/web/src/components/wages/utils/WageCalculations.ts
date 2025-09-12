// Generate 14-day date range
export const generateDateRange = (startDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate + 'T12:00:00');
  
  // Validate the date
  if (isNaN(start.getTime())) {
    console.error('Invalid start date:', startDate);
    return [];
  }
  
  for (let i = 0; i < 14; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  return dates;
};

// Get pay period info based on Group A/B schedule (Saturday to Friday)
export const getPayPeriodInfo = (dateStr: string) => {
  const groupAStart = new Date('2024-08-10T12:00:00'); // Aug 10, 2024 (Saturday - Group A reference)
  const date = new Date(dateStr + 'T12:00:00');
  
  // Calculate weeks since Group A started
  const diffTime = date.getTime() - groupAStart.getTime();
  const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
  
  // Group A weeks: 0, 2, 4, 6... (even weeks)
  // Group B weeks: 1, 3, 5, 7... (odd weeks)
  const isGroupA = diffWeeks % 2 === 0;
  
  return {
    group: isGroupA ? 'A' : 'B',
    weekNumber: diffWeeks
  };
};

export const getCurrentPayPeriod = () => {
  const today = new Date();
  const groupAStart = new Date('2024-08-10'); // Aug 10, 2024 (Saturday)
  
  // Calculate which pay period we're currently in
  const diffTime = today.getTime() - groupAStart.getTime();
  const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
  
  // Find the current pay period start (Saturday)
  const currentPeriodStart = new Date(groupAStart);
  currentPeriodStart.setDate(groupAStart.getDate() + (diffWeeks * 7));
  
  return currentPeriodStart.toISOString().split('T')[0];
};

// Calculate payment date (Friday 2 weeks after pay period ends)
export const calculatePaymentDate = (periodEnd: string): string => {
  const endDate = new Date(periodEnd + 'T12:00:00');
  // Add 14 days
  endDate.setDate(endDate.getDate() + 14);
  // Find next Friday (5 = Friday)
  while (endDate.getDay() !== 5) {
    endDate.setDate(endDate.getDate() + 1);
  }
  return endDate.toISOString().split('T')[0];
};

// Navigation for bi-weekly periods
export const navigateBiWeek = (biWeekStart: string, selectedGroup: string, direction: 'prev' | 'next'): string => {
  const current = new Date(biWeekStart + 'T12:00:00');
  
  // If specific group is selected, navigate within that group (2 weeks)
  if (selectedGroup === 'Group A' || selectedGroup === 'Group B') {
    current.setDate(current.getDate() + (direction === 'next' ? 14 : -14));
  } else {
    // For "all" users, navigate weekly to alternate between groups
    current.setDate(current.getDate() + (direction === 'next' ? 7 : -7));
  }
  
  return current.toISOString().split('T')[0];
};

// Auto-adjust pay period when group selection changes
export const adjustPayPeriodForGroup = (biWeekStart: string, selectedGroup: string): string => {
  if (selectedGroup === 'Group A' || selectedGroup === 'Group B') {
    const currentPeriodInfo = getPayPeriodInfo(biWeekStart);
    const selectedGroupLetter = selectedGroup === 'Group A' ? 'A' : 'B';
    
    // If the selected group doesn't match the current period, adjust the date
    if (currentPeriodInfo.group !== selectedGroupLetter) {
      const current = new Date(biWeekStart + 'T12:00:00');
      
      if (selectedGroupLetter === 'A' && currentPeriodInfo.group === 'B') {
        // Jump back 1 week to get Group A period
        current.setDate(current.getDate() - 7);
      } else if (selectedGroupLetter === 'B' && currentPeriodInfo.group === 'A') {
        // Jump forward 1 week to get Group B period
        current.setDate(current.getDate() + 7);
      }
      
      return current.toISOString().split('T')[0];
    }
  }
  
  return biWeekStart;
};

// Format time helper
export const formatTime = (time: string | null) => {
  if (!time) return '';
  return time.substring(0, 5); // Show HH:MM
};

// Format currency helper
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD'
  }).format(amount);
};

// Generate day labels for the date range
export const generateDayLabels = (dates: string[]) => {
  return dates.map(date => {
    const d = new Date(date + 'T12:00:00');
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.getDate()
    };
  });
};