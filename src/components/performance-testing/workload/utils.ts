// Workload Modeling Utilities and Calculations

import {
  WorkloadModelType,
  BusinessInputs,
  TechnicalInputs,
  LoadLevel,
  WorkloadCalculation,
  SystemType,
  LoadPatternType,
} from '../types';

// Closed Model (User-based)
// Concurrency = Users, TPS depends on response time
export const closedModelCalc = (
  users: number,
  avgRtMs: number,
  thinkTimeMs: number
): { concurrency: number; tps: number } => {
  const tps = users / ((avgRtMs + thinkTimeMs) / 1000);
  return { concurrency: users, tps: Math.round(tps * 100) / 100 };
};

// Open Model (Rate-based) - Little's Law
// Concurrency ≈ TPS × Avg Response Time
export const openModelCalc = (
  targetTps: number,
  avgRtMs: number
): { concurrency: number; tps: number } => {
  const concurrency = Math.ceil(targetTps * (avgRtMs / 1000));
  return { concurrency, tps: targetTps };
};

// Calculate load level multiplier
export const getLoadLevelMultiplier = (level: LoadLevel): number => {
  switch (level) {
    case 'baseline':
      return 0.2;
    case 'normal':
      return 0.7;
    case 'peak':
      return 1.0;
    case 'stress':
      return 1.5;
    default:
      return 1.0;
  }
};

// Calculate concurrent users from business inputs
export const calculateConcurrentUsersFromBusiness = (
  inputs: BusinessInputs
): number => {
  const avgSessionsPerHour = inputs.dailyActiveUsers / 8; // Assume 8 active hours
  const peakSessionsPerHour = avgSessionsPerHour * inputs.peakHourMultiplier;
  const concurrentUsers = Math.ceil(
    (peakSessionsPerHour * inputs.sessionDurationMinutes) / 60
  );
  return concurrentUsers;
};

// Calculate TPS from business inputs
export const calculateTpsFromBusiness = (inputs: BusinessInputs): number => {
  const concurrentUsers = calculateConcurrentUsersFromBusiness(inputs);
  const actionsPerMinute = inputs.averageActionsPerSession / inputs.sessionDurationMinutes;
  const tps = Math.round((concurrentUsers * actionsPerMinute) / 60 * 100) / 100;
  return tps;
};

// Full workload calculation
export const calculateWorkload = (
  modelType: WorkloadModelType,
  businessInputs: BusinessInputs,
  technicalInputs: TechnicalInputs,
  loadLevel: LoadLevel,
  thinkTimeMs: number
): WorkloadCalculation => {
  const multiplier = getLoadLevelMultiplier(loadLevel);
  
  if (modelType === 'open') {
    // Open model: Target TPS is fixed, calculate required users
    const targetTps = technicalInputs.targetTps * multiplier;
    const { concurrency } = openModelCalc(targetTps, technicalInputs.avgResponseTimeMs);
    
    return {
      concurrentUsers: concurrency,
      targetTps: Math.round(targetTps * 100) / 100,
      rampUpTime: calculateRampUpTime(concurrency),
      duration: calculateDuration(loadLevel),
      thinkTime: thinkTimeMs,
      formula: `Concurrency = TPS × Avg RT = ${targetTps.toFixed(1)} × ${(technicalInputs.avgResponseTimeMs / 1000).toFixed(2)}s = ${concurrency}`,
      explanation: `Using Little's Law for open workload model with ${loadLevel} load level (${multiplier * 100}% of peak).`,
    };
  } else {
    // Closed model: Users are fixed, TPS depends on response time
    const baseUsers = calculateConcurrentUsersFromBusiness(businessInputs);
    const users = Math.ceil(baseUsers * multiplier);
    const { tps } = closedModelCalc(users, technicalInputs.avgResponseTimeMs, thinkTimeMs);
    
    return {
      concurrentUsers: users,
      targetTps: tps,
      rampUpTime: calculateRampUpTime(users),
      duration: calculateDuration(loadLevel),
      thinkTime: thinkTimeMs,
      formula: `TPS = Users / (RT + ThinkTime) = ${users} / (${technicalInputs.avgResponseTimeMs}ms + ${thinkTimeMs}ms) = ${tps.toFixed(2)}`,
      explanation: `Using closed workload model with ${loadLevel} load level (${multiplier * 100}% of peak).`,
    };
  }
};

// Calculate ramp-up time based on user count
export const calculateRampUpTime = (users: number): number => {
  if (users <= 50) return 60;
  if (users <= 200) return 120;
  if (users <= 500) return 300;
  return 600;
};

// Calculate duration based on load level
export const calculateDuration = (level: LoadLevel): number => {
  switch (level) {
    case 'baseline':
      return 300; // 5 minutes
    case 'normal':
      return 1800; // 30 minutes
    case 'peak':
      return 900; // 15 minutes
    case 'stress':
      return 600; // 10 minutes - until failure
    default:
      return 600;
  }
};

// Get recommended model type based on system type
export const getRecommendedModelType = (systemType: SystemType): WorkloadModelType => {
  switch (systemType) {
    case 'api':
    case 'microservices':
    case 'auth':
      return 'open';
    case 'ui-web':
    case 'erp':
      return 'closed';
    default:
      return 'closed';
  }
};

// Get recommended load pattern based on system type
export const getRecommendedLoadPattern = (systemType: SystemType): LoadPatternType => {
  switch (systemType) {
    case 'api':
    case 'microservices':
      return 'steady';
    case 'auth':
      return 'spike';
    case 'ui-web':
      return 'ramp-up';
    case 'erp':
      return 'diurnal';
    default:
      return 'ramp-up';
  }
};

// Format duration for display
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

// Get system type label
export const getSystemTypeLabel = (type: SystemType): string => {
  const labels: Record<SystemType, string> = {
    'ui-web': 'UI / Web Application',
    'api': 'REST APIs',
    'auth': 'Authentication (OAuth/SSO)',
    'erp': 'ERP / Legacy System',
    'microservices': 'Microservices',
  };
  return labels[type] || type;
};

// Get load pattern label
export const getLoadPatternLabel = (pattern: LoadPatternType): string => {
  const labels: Record<LoadPatternType, string> = {
    'steady': 'Steady Load',
    'ramp-up': 'Ramp-Up Load',
    'spike': 'Spike Load',
    'diurnal': 'Diurnal Pattern',
    'custom': 'Custom Pattern',
  };
  return labels[pattern] || pattern;
};

// Get load level label
export const getLoadLevelLabel = (level: LoadLevel): string => {
  const labels: Record<LoadLevel, string> = {
    'baseline': 'Baseline (20%)',
    'normal': 'Normal (70%)',
    'peak': 'Peak (100%)',
    'stress': 'Stress (150%)',
  };
  return labels[level] || level;
};
