export const TEAM_COLORS = {
  mclaren: '#FF8000',
  ferrari: '#E8002D',
  red_bull: '#3671C6',
  mercedes: '#27F4D2',
  aston_martin: '#229971',
  alpine: '#FF87BC',
  haas: '#B6BABD',
  rb: '#6692FF',
  williams: '#64C4FF',
  sauber: '#52E252',
}

export const COMPOUND_COLORS = {
  SOFT: '#FF3333',
  MEDIUM: '#FFF200',
  HARD: '#FFFFFF',
  INTERMEDIATE: '#39B54A',
  WET: '#0067FF',
  UNKNOWN: '#888888',
}

export const COMPOUND_SHORT = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  WET: 'W',
  UNKNOWN: '?',
}

export const SESSION_TYPE_ORDER = {
  'Practice': 1,
  'Practice 1': 1,
  'Practice 2': 2,
  'Practice 3': 3,
  'Sprint Shootout': 4,
  'Sprint Qualifying': 4,
  'Sprint': 5,
  'Qualifying': 6,
  'Race': 7,
}

// 2026 power-unit spec: the MGU-H was removed; allocations are
// ICE/Turbo/Exhaust = 4 and MGU-K/Energy Store/Control Electronics = 3.
export const PU_COMPONENTS = [
  { key: 'ICE', label: 'ICE', full: 'Internal Combustion Engine', limit: 4 },
  { key: 'TC', label: 'TC', full: 'Turbocharger', limit: 4 },
  { key: 'MGU-K', label: 'MGU-K', full: 'Motor Generator Unit - Kinetic', limit: 3 },
  { key: 'ES', label: 'ES', full: 'Energy Store', limit: 3 },
  { key: 'CE', label: 'CE', full: 'Control Electronics', limit: 3 },
  { key: 'Exhaust', label: 'EXH', full: 'Exhaust', limit: 4 },
]

export const API_BASE = '/api'
