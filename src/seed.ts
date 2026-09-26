import type { ExerciseKind, TemplateExercise, WorkoutType } from './db'

// Transcribed from the programme screenshots (Level 2).
const ex = (
  id: string, name: string, target: string, kind: ExerciseKind,
  extra: Partial<TemplateExercise> = {},
): TemplateExercise => ({ id, name, sets: 3, target, kind, ...extra })

export const SEED_TYPES: WorkoutType[] = [
  {
    id: 'w1', code: 'W1', name: 'Squat & Push', color: 'cyan', order: 1,
    exercises: [
      ex('w1-1', 'Back Squat - Barbell', '8', 'weight'),
      ex('w1-2', 'Mini Band Wall Sit', '30sec', 'time', { notes: 'Optional band' }),
      ex('w1-3', 'Bench Press - DB - Semi Supinated', '10-12', 'weight'),
      ex('w1-4', 'Front Foot Elevated Split Squat', '6', 'weight', { perSide: true }),
      ex('w1-5', 'Rings - Plank', '30sec', 'time'),
      ex('w1-6', 'Press Up - Modified Incline', '10-20', 'reps'),
    ],
  },
  {
    id: 'w2', code: 'W2', name: 'Bench & Pull', color: 'pink', order: 2,
    exercises: [
      ex('w2-1', 'Bench Press - BB', '5', 'weight'),
      ex('w2-2', 'Iso Press Up Hold', '10sec', 'time'),
      ex('w2-3', 'Bent Over Row - BB', '8', 'weight', { notes: 'Can also use DB' }),
      ex('w2-4', 'Row - Rings - Paused', '10', 'reps'),
      ex('w2-5', 'Dumbbell Lateral Step Up', '8', 'weight', { perSide: true, notes: 'Stack 2-3 20kg plates' }),
      ex('w2-6', 'Zottman Curl', '10-20', 'weight'),
      ex('w2-7', 'Lateral Raise - DB', '10-20', 'weight'),
    ],
  },
  {
    id: 'w3', code: 'W3', name: 'Hinge & Press', color: 'lime', order: 3,
    exercises: [
      ex('w3-1', 'Romanian Deadlift - BB', '8-10', 'weight'),
      ex('w3-2', 'Dumbbell Split Squat Isometric Hold', '30sec', 'time'),
      ex('w3-3', 'Shoulder Press - DB - Seated', '10-12', 'weight'),
      ex('w3-4', 'Suspension Single Leg Squat', '6', 'reps', { perSide: true, notes: 'Rings' }),
      ex('w3-5', 'Dumbbell Upright Row', '10-20', 'weight'),
      ex('w3-6', 'Curl Up - Slow', '10', 'reps'),
      ex('w3-7', 'Side Plank - All Levels', '30sec', 'time'),
    ],
  },
]
