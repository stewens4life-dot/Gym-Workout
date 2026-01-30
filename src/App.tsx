import { useState, useEffect, useMemo } from 'react'

import { Calendar, Plus, BarChart2, Save, Trash2, Dumbbell, ChevronLeft, ChevronRight, Activity, TrendingUp, Loader, Cloud, LogIn, User, LogOut, Layers, BicepsFlexed, Target, Flame, Trophy, Zap, TrendingDown, Award, Weight, Gauge, ArrowUpRight, ArrowDownRight, UserCircle, Ruler, Scale, Heart, Edit2, X, Check, Sun, Moon, Coffee } from 'lucide-react'

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

import { initializeApp } from 'firebase/app'

import { getAuth, signInWithCustomToken, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence, signOut } from 'firebase/auth'

import { getFirestore, doc, setDoc, getDoc, deleteDoc, onSnapshot, collection, query } from 'firebase/firestore'



interface Set {

  weight: string

  reps: string

}



interface Exercise {

  id: number

  name: string

  sets: Set[]

}



interface Workout {

  id: number

  date: string

  split: string

  exercises: Exercise[]

  isRestDay?: boolean // indica si es un día de descanso

}



interface UserProfile {

  age: number

  height: number // en cm

  weight: number // en kg

  restDaysPerWeek?: number // días de descanso permitidos por semana

}



interface BodyMeasurement {

  id: number

  date: string

  weight: number // en kg

  chest?: number | undefined // en cm

  waist?: number | undefined // en cm

  hips?: number | undefined // en cm

  biceps?: number | undefined // en cm

  thighs?: number | undefined // en cm

}



const FIREBASE_CONFIG = {

  apiKey: "AIzaSyDfR69yaxonCqGZQliAmopg-ywtUr8LAzk",

  authDomain: "arnold-tracker.firebaseapp.com",

  projectId: "arnold-tracker",

  storageBucket: "arnold-tracker.firebasestorage.app",

  messagingSenderId: "907261527912",

  appId: "1:907261527912:web:4e62a212b7952ff9fb8dd",

  measurementId: "G-HWXWRPDF8K"

}



const APP_ID = FIREBASE_CONFIG.appId



// Zona horaria de Bogotá, Colombia

const BOGOTA_TIMEZONE = 'America/Bogota'



// Obtener fecha en formato YYYY-MM-DD usando zona horaria de Bogotá

const formatDate = (date: Date): string => {

  // Convertir la fecha a la zona horaria de Bogotá

  const formatter = new Intl.DateTimeFormat('en-CA', {

    timeZone: BOGOTA_TIMEZONE,

    year: 'numeric',

    month: '2-digit',

    day: '2-digit'

  })

  return formatter.format(date)

}



// Obtener fecha de hoy en Bogotá

const getTodayBogota = (): Date => {

  const now = new Date()

  // Crear una fecha usando la hora local de Bogotá

  const bogotaString = now.toLocaleString('en-US', { 

    timeZone: BOGOTA_TIMEZONE,

    year: 'numeric',

    month: '2-digit',

    day: '2-digit',

    hour: '2-digit',

    minute: '2-digit',

    second: '2-digit',

    hour12: false

  })

  return new Date(bogotaString)

}



const getDaysInMonth = (year: number, month: number): number => new Date(year, month + 1, 0).getDate()

const getFirstDayOfMonth = (year: number, month: number): number => new Date(year, month, 1).getDay()



const DEFAULT_SPLIT: Record<string, string[]> = {

  'Pecho y Espalda': ['Press Banca', 'Remo con Barra', 'Press Inclinado', 'Dominadas', 'Aperturas', 'Pull Over'],

  'Hombros y Brazos': ['Press Militar', 'Elevaciones Laterales', 'Curl con Barra', 'Press Francés', 'Curl Martillo', 'Extensiones Tríceps'],

  'Pierna': ['Sentadilla', 'Peso Muerto Rumano', 'Prensa', 'Extensiones de Cuádriceps', 'Curl Femoral', 'Pantorrillas']

}



const AVAILABLE_MUSCLES = [

  'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Antebrazos',

  'Cuádriceps', 'Femorales', 'Glúteos', 'Pantorrillas', 'Abdominales', 'Trapecio'

]



const App = () => {

  const [view, setView] = useState<'dashboard' | 'calendar' | 'log' | 'stats' | 'profile'>('dashboard')

  const [workouts, setWorkouts] = useState<Workout[]>([])

  const [selectedDate, setSelectedDate] = useState(getTodayBogota())

  const [logDate, setLogDate] = useState(formatDate(getTodayBogota()))

  const [selectedSplit, setSelectedSplit] = useState('Pecho y Espalda')

  const [currentExercises, setCurrentExercises] = useState<Exercise[]>([])

  

  // Auth State

  const [db, setDb] = useState<any>(null)

  const [auth, setAuth] = useState<any>(null)

  const [user, setUser] = useState<any>(null)

  const [userId, setUserId] = useState<string | null>(null)

  const [isAuthReady, setIsAuthReady] = useState(false)

  const [isLoading, setIsLoading] = useState(true)

  const [showAuthModal, setShowAuthModal] = useState(false)

  

  // Stats State

  const [statExercise, setStatExercise] = useState('')

  

  // Notification State

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)

  

  // Profile State

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurement[]>([])

  const [measurementDate, setMeasurementDate] = useState(formatDate(getTodayBogota()))

  const [newMeasurement, setNewMeasurement] = useState<{

    weight: string

    chest: string

    waist: string

    hips: string

    biceps: string

    thighs: string

  }>({

    weight: '',

    chest: '',

    waist: '',

    hips: '',

    biceps: '',

    thighs: ''

  })



  // Custom Splits State

  const [customSplits, setCustomSplits] = useState<Record<string, string[]>>(DEFAULT_SPLIT)

  const [splitColors, setSplitColors] = useState<Record<string, string>>({})

  const [splitMuscles, setSplitMuscles] = useState<Record<string, string[]>>({})

  const [editingSplit, setEditingSplit] = useState<string | null>(null)

  const [editingSplitName, setEditingSplitName] = useState('')

  const [showSplitEditor, setShowSplitEditor] = useState(false)

  const [splitToDelete, setSplitToDelete] = useState<string | null>(null)

  

  // Activity State

  const [showAllActivity, setShowAllActivity] = useState(false)

  

  // Theme State

  const [isDarkMode, setIsDarkMode] = useState(true)

  

  // Delete Confirmation Modal

  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const [workoutToDelete, setWorkoutToDelete] = useState<string | null>(null)

  const [deleteModalType, setDeleteModalType] = useState<'workout' | 'split'>('workout')

  

  // Renombrar ejercicio global

  const [showRenameModal, setShowRenameModal] = useState(false)

  const [renameOldName, setRenameOldName] = useState('')

  const [renameNewName, setRenameNewName] = useState('')

  

  // Cargar preferencia de tema desde Firestore

  useEffect(() => {

    if (!isAuthReady || !db || !userId) return



    const themeRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'theme')

    getDoc(themeRef).then((docSnap) => {

      if (docSnap.exists()) {

        const themeData = docSnap.data()

        if (themeData?.isDarkMode !== undefined) {

          setIsDarkMode(themeData.isDarkMode)

        }

      }

    }).catch((error) => {

      console.error('Error loading theme preference', error)

    })

  }, [isAuthReady, db, userId])



  // Guardar preferencia de tema

  const saveThemePreference = async (darkMode: boolean) => {

    if (!db || !userId) return

    try {

      const themeRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'theme')

      await setDoc(themeRef, { isDarkMode: darkMode }, { merge: true })

    } catch (error) {

      console.error('Error saving theme preference', error)

    }

  }



  const toggleDarkMode = () => {

    const newMode = !isDarkMode

    setIsDarkMode(newMode)

    if (userId) {

      saveThemePreference(newMode)

    }

  }



  const initialAuthToken: string | null = typeof window !== 'undefined' && (window as any).initialAuthToken ? (window as any).initialAuthToken : null



  // Función para mostrar notificaciones

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {

    setNotification({ message, type })

    setTimeout(() => setNotification(null), 4000)

  }



  useEffect(() => {

    const app = initializeApp(FIREBASE_CONFIG)

    const firestore = getFirestore(app)

    const authInstance = getAuth(app)

    

    setDb(firestore)

    setAuth(authInstance)



    setPersistence(authInstance, browserLocalPersistence).catch(console.error)



    const authenticate = async () => {

      if (initialAuthToken) {

        try {

          await signInWithCustomToken(authInstance, initialAuthToken)

        } catch (error) {

          console.error('Fallo la autenticación con token personalizado', error)

        }

      }



      const unsubscribe = onAuthStateChanged(authInstance, (user) => {

        if (user) {

          setUser(user)

          setUserId(user.uid)

          setShowAuthModal(false)

        } else {

          setUser(null)

          setUserId(null)

          if (!isLoading) setShowAuthModal(true)

        }

        setIsAuthReady(true)

        setIsLoading(false)

      })



      return unsubscribe

    }



    authenticate()

  }, [])



  useEffect(() => {

    if (isAuthReady && !userId) {

      setShowAuthModal(true)

    }

  }, [isAuthReady, userId])



  useEffect(() => {

    if (!isAuthReady || !db || !userId) {

      setWorkouts([])

      return

    }



    const workoutsCollectionRef = collection(db, 'artifacts', APP_ID, 'users', userId, 'workouts')

    const q = query(workoutsCollectionRef)

    const unsubscribe = onSnapshot(q, (snapshot) => {

      const loadedWorkouts: Workout[] = []

      snapshot.forEach((doc) => {

        const data = doc.data() as Workout

        loadedWorkouts.push(data)

      })

      setWorkouts(loadedWorkouts)

    }, (error) => {

      console.error('Error fetching workouts from Firestore', error)

      console.error('Error details:', error.code, error.message)

    })



    return unsubscribe

  }, [isAuthReady, db, userId])



  // Cargar perfil de usuario

  useEffect(() => {

    if (!isAuthReady || !db || !userId) {

      setUserProfile(null)

      return

    }



    const profileRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'profile', 'data')

    getDoc(profileRef).then((docSnap) => {

      if (docSnap.exists()) {

        setUserProfile(docSnap.data() as UserProfile)

      }

    }).catch((error) => {

      console.error('Error loading profile', error)

    })

  }, [isAuthReady, db, userId])



  // Cargar medidas corporales

  useEffect(() => {

    if (!isAuthReady || !db || !userId) {

      setBodyMeasurements([])

      return

    }



    const measurementsCollectionRef = collection(db, 'artifacts', APP_ID, 'users', userId, 'measurements')

    const q = query(measurementsCollectionRef)

    const unsubscribe = onSnapshot(q, (snapshot) => {

      const loadedMeasurements: BodyMeasurement[] = []

      snapshot.forEach((doc) => loadedMeasurements.push(doc.data() as BodyMeasurement))

      setBodyMeasurements(loadedMeasurements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))

    }, (error) => {

      console.error('Error fetching measurements from Firestore', error)

    })



    return unsubscribe

  }, [isAuthReady, db, userId])



  // Cargar splits personalizados y colores

  useEffect(() => {

    if (!isAuthReady || !db || !userId) {

      setCustomSplits(DEFAULT_SPLIT)

      return

    }



    const splitsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'splits')

    const colorsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'splitColors')

    const musclesRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'splitMuscles')

    

    Promise.all([getDoc(splitsRef), getDoc(colorsRef), getDoc(musclesRef)]).then(([splitsSnap, colorsSnap, musclesSnap]) => {

      if (splitsSnap.exists()) {

        const loadedSplits = splitsSnap.data() as Record<string, string[]>

        setCustomSplits(loadedSplits)

        

        // Cargar músculos

        if (musclesSnap.exists()) {

          setSplitMuscles(musclesSnap.data() as Record<string, string[]>)

        } else {

          // Inicializar músculos por defecto basados en nombres de splits

          const defaultMuscles: Record<string, string[]> = {}

          Object.keys(loadedSplits).forEach(split => {

            if (split.includes('Pecho')) defaultMuscles[split] = ['Pecho', 'Espalda']

            else if (split.includes('Hombro')) defaultMuscles[split] = ['Hombros', 'Bíceps', 'Tríceps']

            else if (split.includes('Pierna')) defaultMuscles[split] = ['Cuádriceps', 'Femorales', 'Glúteos', 'Pantorrillas']

            else defaultMuscles[split] = []

          })

          setSplitMuscles(defaultMuscles)

          setDoc(musclesRef, defaultMuscles, { merge: true }).catch(console.error)

        }

        

        // Cargar colores o generar nuevos

        if (colorsSnap.exists()) {

          setSplitColors(colorsSnap.data() as Record<string, string>)

        } else {

          // Generar colores para splits sin color asignado

          const newColors: Record<string, string> = {}

          Object.keys(loadedSplits).forEach((split, index) => {

            if (!newColors[split]) {

              newColors[split] = generateSplitColor(split, index)

            }

          })

          setSplitColors(newColors)

          // Guardar colores generados

          setDoc(colorsRef, newColors, { merge: true }).catch(console.error)

        }

      }

    }).catch((error) => {

      console.error('Error loading custom splits', error)

    })

  }, [isAuthReady, db, userId])



  useEffect(() => {

    if (view === 'log' && userId) {

      const existingWorkout = workouts.find(w => w.date === logDate)

      if (existingWorkout) {

        setSelectedSplit(existingWorkout.split)

        setCurrentExercises(existingWorkout.exercises)

      } else {

        setCurrentExercises([])

      }

    }

  }, [logDate, view, workouts, userId])



  const signInWithGoogle = async () => {

    if (!auth) return

    try {

      const provider = new GoogleAuthProvider()

      await signInWithPopup(auth, provider)

    } catch (error) {

      console.error('Error durante el inicio de sesión con Google', error)

    }

  }



  const handleSignOut = async () => {

    if (!auth) return

    try {

      await signOut(auth)

      setWorkouts([])

      setUserProfile(null)

      setBodyMeasurements([])

      setView('dashboard')

    } catch (error) {

      console.error('Error al cerrar sesión', error)

    }

  }



  // Guardar perfil de usuario

  const saveProfile = async () => {

    if (!db || !userId) {

      showNotification('Error: No se puede guardar el perfil.', 'error')

      return

    }



    try {

      const profileRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'profile', 'data')

      await setDoc(profileRef, userProfile, { merge: true })

      showNotification('Perfil guardado exitosamente', 'success')

    } catch (error) {

      console.error('Error saving profile', error)

      showNotification('Error al guardar el perfil', 'error')

    }

  }



  // Guardar medida corporal

  const saveMeasurement = async () => {

    if (!db || !userId) {

      showNotification('Error: No se puede guardar la medida.', 'error')

      return

    }



    if (!newMeasurement.weight || parseFloat(newMeasurement.weight) <= 0) {

      showNotification('Por favor, ingresa al menos el peso.', 'warning')

      return

    }



    try {

      const measurement: BodyMeasurement = {

        id: Date.now(),

        date: measurementDate,

        weight: parseFloat(newMeasurement.weight),

        chest: newMeasurement.chest ? parseFloat(newMeasurement.chest) : undefined,

        waist: newMeasurement.waist ? parseFloat(newMeasurement.waist) : undefined,

        hips: newMeasurement.hips ? parseFloat(newMeasurement.hips) : undefined,

        biceps: newMeasurement.biceps ? parseFloat(newMeasurement.biceps) : undefined,

        thighs: newMeasurement.thighs ? parseFloat(newMeasurement.thighs) : undefined

      }



      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'measurements', measurementDate)

      await setDoc(docRef, measurement, { merge: true })

      

      showNotification('Medida guardada exitosamente', 'success')

      setNewMeasurement({

        weight: '',

        chest: '',

        waist: '',

        hips: '',

        biceps: '',

        thighs: ''

      })

    } catch (error) {

      console.error('Error saving measurement', error)

      showNotification('Error al guardar la medida', 'error')

    }

  }



  // Eliminar entrenamiento de un día

  const confirmDeleteWorkout = (date: string) => {

    setWorkoutToDelete(date)

    setShowDeleteModal(true)

  }



  const deleteWorkout = async () => {

    if (!db || !userId || !workoutToDelete) {

      showNotification('Error: No se puede eliminar el entrenamiento.', 'error')

      setShowDeleteModal(false)

      setWorkoutToDelete(null)

      return

    }



    try {

      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'workouts', workoutToDelete)

      await deleteDoc(docRef)

      showNotification('Entrenamiento eliminado exitosamente', 'success')

      if (view === 'log' && logDate === workoutToDelete) {

        setCurrentExercises([])

      }

      setShowDeleteModal(false)

      setWorkoutToDelete(null)

    } catch (error) {

      console.error('Error deleting workout', error)

      showNotification('Error al eliminar el entrenamiento', 'error')

      setShowDeleteModal(false)

      setWorkoutToDelete(null)

    }

  }



  // Tomar día de descanso

  const takeRestDay = async () => {

    if (!db || !userId) {

      if (!userId) setShowAuthModal(true)

      else showNotification('Error: La base de datos no está lista.', 'error')

      return

    }



    const today = formatDate(getTodayBogota())

    const todayDate = getTodayBogota()

    

    // Validar que no sea domingo

    if (todayDate.getDay() === 0) {

      showNotification('Los domingos ya son días de descanso y no afectan la racha.', 'info')

      return

    }



    // Verificar si ya hay un entrenamiento o descanso hoy

    const existingWorkout = workouts.find(w => w.date === today)

    if (existingWorkout && !existingWorkout.isRestDay) {

      showNotification('Ya tienes un entrenamiento registrado para hoy.', 'warning')

      return

    }



    try {

      const restDayWorkout: Workout = {

        id: Date.now(),

        date: today,

        split: 'Descanso',

        exercises: [],

        isRestDay: true

      }



      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'workouts', today)

      await setDoc(docRef, restDayWorkout, { merge: true })

      

      showNotification('Día de descanso registrado. ¡Tu racha sigue intacta! 💪', 'success')

    } catch (error) {

      console.error('Error saving rest day', error)

      showNotification('Error al registrar el día de descanso', 'error')

    }

  }



  // Calcular IMC

  const calculateBMI = (): number | null => {

    if (!userProfile || !userProfile.height || !userProfile.weight) return null

    const heightInMeters = userProfile.height / 100

    return parseFloat((userProfile.weight / (heightInMeters * heightInMeters)).toFixed(1))

  }



  const getBMICategory = (bmi: number): { label: string; color: string } => {

    if (bmi < 18.5) return { label: 'Bajo peso', color: 'text-blue-400' }

    if (bmi < 25) return { label: 'Normal', color: 'text-emerald-400' }

    if (bmi < 30) return { label: 'Sobrepeso', color: 'text-yellow-400' }

    return { label: 'Obesidad', color: 'text-red-400' }

  }



  // Generar color para split

  const generateSplitColor = (splitName: string, index: number): string => {

    const defaultColors = ['blue', 'purple', 'red', 'green', 'orange', 'cyan', 'pink', 'indigo', 'amber', 'teal']

    if (splitColors[splitName]) return splitColors[splitName]

    return defaultColors[index % defaultColors.length]

  }



  // Obtener clases de color para split

  const getSplitColorClasses = (colorName: string, isDark: boolean): { bg: string; border: string; text: string } => {

    const colorMap: Record<string, { dark: { bg: string; border: string; text: string }; light: { bg: string; border: string; text: string } }> = {

      blue: { dark: { bg: 'bg-blue-900/80', border: 'border-blue-500', text: 'text-white' }, light: { bg: 'bg-blue-200', border: 'border-blue-400', text: 'text-blue-800' } },

      purple: { dark: { bg: 'bg-purple-900/80', border: 'border-purple-500', text: 'text-white' }, light: { bg: 'bg-purple-200', border: 'border-purple-400', text: 'text-purple-800' } },

      red: { dark: { bg: 'bg-red-900/80', border: 'border-red-500', text: 'text-white' }, light: { bg: 'bg-red-200', border: 'border-red-400', text: 'text-red-800' } },

      green: { dark: { bg: 'bg-green-900/80', border: 'border-green-500', text: 'text-white' }, light: { bg: 'bg-green-200', border: 'border-green-400', text: 'text-green-800' } },

      orange: { dark: { bg: 'bg-orange-900/80', border: 'border-orange-500', text: 'text-white' }, light: { bg: 'bg-orange-200', border: 'border-orange-400', text: 'text-orange-800' } },

      cyan: { dark: { bg: 'bg-cyan-900/80', border: 'border-cyan-500', text: 'text-white' }, light: { bg: 'bg-cyan-200', border: 'border-cyan-400', text: 'text-cyan-800' } },

      pink: { dark: { bg: 'bg-pink-900/80', border: 'border-pink-500', text: 'text-white' }, light: { bg: 'bg-pink-200', border: 'border-pink-400', text: 'text-pink-800' } },

      indigo: { dark: { bg: 'bg-indigo-900/80', border: 'border-indigo-500', text: 'text-white' }, light: { bg: 'bg-indigo-200', border: 'border-indigo-400', text: 'text-indigo-800' } },

      amber: { dark: { bg: 'bg-amber-900/80', border: 'border-amber-500', text: 'text-white' }, light: { bg: 'bg-amber-200', border: 'border-amber-400', text: 'text-amber-800' } },

      teal: { dark: { bg: 'bg-teal-900/80', border: 'border-teal-500', text: 'text-white' }, light: { bg: 'bg-teal-200', border: 'border-teal-400', text: 'text-teal-800' } },

    }

    const color = colorMap[colorName] || colorMap.blue

    return isDark ? color.dark : color.light

  }



  // Guardar splits personalizados

  const saveCustomSplits = async () => {

    if (!db || !userId) {

      showNotification('Error: No se puede guardar la configuración.', 'error')

      return

    }



    try {

      const splitsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'splits')

      await setDoc(splitsRef, customSplits, { merge: true })

      

      // Guardar colores de splits

      const colorsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'splitColors')

      await setDoc(colorsRef, splitColors, { merge: true })

      

      // Guardar músculos de splits

      const musclesRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'splitMuscles')

      await setDoc(musclesRef, splitMuscles, { merge: true })

      

      showNotification('Splits personalizados guardados exitosamente', 'success')

      setShowSplitEditor(false)

    } catch (error) {

      console.error('Error saving custom splits', error)

      showNotification('Error al guardar los splits', 'error')

    }

  }



  // Toggle músculo en split

  const toggleMuscleInSplit = (splitName: string, muscle: string) => {

    const currentMuscles = splitMuscles[splitName] || []

    const newMuscles = currentMuscles.includes(muscle)

      ? currentMuscles.filter(m => m !== muscle)

      : [...currentMuscles, muscle]

    

    setSplitMuscles({ ...splitMuscles, [splitName]: newMuscles })

  }



  // Editar nombre de split

  const updateSplitName = async (oldName: string, newName: string) => {

    if (!newName.trim()) {

      showNotification('El nombre del split no puede estar vacío', 'warning')

      return

    }

    

    if (oldName === newName) {

      setEditingSplit(null)

      return

    }



    const newSplits = { ...customSplits }

    newSplits[newName] = newSplits[oldName]

    delete newSplits[oldName]

    

    // Actualizar colores

    const newColors = { ...splitColors }

    if (newColors[oldName]) {

      newColors[newName] = newColors[oldName]

      delete newColors[oldName]

    }

    

    // Actualizar workouts existentes con el nuevo nombre

    setWorkouts(workouts.map(w => 

      w.split === oldName ? { ...w, split: newName } : w

    ))

    

    setCustomSplits(newSplits)

    setSplitColors(newColors)

    setEditingSplit(null)

    

    if (selectedSplit === oldName) {

      setSelectedSplit(newName)

    }



    // Guardar inmediatamente

    if (db && userId) {

      try {

        const splitsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'splits')

        await setDoc(splitsRef, newSplits, { merge: true })

        const colorsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'splitColors')

        await setDoc(colorsRef, newColors, { merge: true })

      } catch (error) {

        console.error('Error saving split name', error)

      }

    }

  }



  // Eliminar split

  const deleteSplit = async () => {

    if (!splitToDelete) return

    

    if (Object.keys(customSplits).length <= 1) {

      showNotification('Debes tener al menos un split', 'warning')

      setShowDeleteModal(false)

      setSplitToDelete(null)

      return

    }



    const newSplits = { ...customSplits }

    delete newSplits[splitToDelete]

    const newColors = { ...splitColors }

    delete newColors[splitToDelete]

    const newMuscles = { ...splitMuscles }

    delete newMuscles[splitToDelete]

    

    setCustomSplits(newSplits)

    setSplitColors(newColors)

    setSplitMuscles(newMuscles)

    

    if (selectedSplit === splitToDelete) {

      setSelectedSplit(Object.keys(newSplits)[0])

    }



    // Guardar inmediatamente - usar setDoc sin merge para eliminar completamente el campo

    if (db && userId) {

      try {

        const splitsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'splits')

        // Usar setDoc sin merge para sobrescribir completamente y eliminar el campo

        await setDoc(splitsRef, newSplits)

        

        const colorsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'splitColors')

        await setDoc(colorsRef, newColors)

        

        const musclesRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'splitMuscles')

        await setDoc(musclesRef, newMuscles)

        

        showNotification('Split eliminado exitosamente', 'success')

      } catch (error) {

        console.error('Error deleting split', error)

        showNotification('Error al eliminar el split', 'error')

      }

    }

    

    setShowDeleteModal(false)

    setSplitToDelete(null)

  }



  // Agregar ejercicio a un split

  const addExerciseToSplit = (splitName: string, exerciseName: string) => {

    if (!exerciseName.trim()) {

      showNotification('El nombre del ejercicio no puede estar vacío', 'warning')

      return

    }



    const newSplits = { ...customSplits }

    if (!newSplits[splitName]) {

      newSplits[splitName] = []

    }

    if (!newSplits[splitName].includes(exerciseName)) {

      newSplits[splitName] = [...newSplits[splitName], exerciseName]

      setCustomSplits(newSplits)

    }

  }



  // Eliminar ejercicio de un split

  const removeExerciseFromSplit = (splitName: string, exerciseName: string) => {

    const newSplits = { ...customSplits }

    if (newSplits[splitName]) {

      newSplits[splitName] = newSplits[splitName].filter(ex => ex !== exerciseName)

      setCustomSplits(newSplits)

    }

  }



  // Obtener ejercicios más usados según grupo muscular/split

  const getMostUsedExercises = useMemo(() => {

    if (!userId || workouts.length === 0) return []

    

    const exerciseCounts: Record<string, number> = {}

    

    // Contar ejercicios usados en el split seleccionado

    workouts.forEach(workout => {

      if (workout.split === selectedSplit && !workout.isRestDay) {

        workout.exercises.forEach(ex => {

          exerciseCounts[ex.name] = (exerciseCounts[ex.name] || 0) + 1

        })

      }

    })

    

    // Ordenar por frecuencia y devolver los más usados

    return Object.entries(exerciseCounts)

      .sort((a, b) => b[1] - a[1])

      .slice(0, 10)

      .map(([name]) => name)

  }, [userId, workouts, selectedSplit])



  // Promedio y máximo de peso por ejercicio (para mostrar al agregar)

  const exerciseStatsByName = useMemo((): Record<string, { avg: number; max: number; count: number }> => {

    const stats: Record<string, { weights: number[] }> = {}

    if (!userId || workouts.length === 0) return {}

    workouts.forEach(workout => {

      if (workout.isRestDay) return

      workout.exercises.forEach(ex => {

        if (!stats[ex.name]) stats[ex.name] = { weights: [] }

        ex.sets.forEach(set => {

          const w = parseFloat(set.weight) || 0

          if (w > 0) stats[ex.name].weights.push(w)

        })

      })

    })

    const result: Record<string, { avg: number; max: number; count: number }> = {}

    Object.entries(stats).forEach(([name, { weights }]) => {

      if (weights.length === 0) return

      const sum = weights.reduce((a, b) => a + b, 0)

      result[name] = {

        avg: Math.round((sum / weights.length) * 10) / 10,

        max: Math.max(...weights),

        count: weights.length

      }

    })

    return result

  }, [userId, workouts])



  const handleAddExercise = (exerciseName: string) => {

    if (!userId) {

      setShowAuthModal(true)

      return

    }

    // Nuevo ejercicio arriba para no tener que bajar

    setCurrentExercises([{ id: Date.now(), name: exerciseName, sets: [{ weight: '', reps: '' }] }, ...currentExercises])

  }



  // Lista de todos los nombres de ejercicios en el historial (para renombrar global)

  const allUniqueExerciseNames = useMemo(() => {

    const set = new Set<string>()

    workouts.forEach(w => {

      if (w.isRestDay) return

      w.exercises.forEach(ex => set.add(ex.name))

    })

    return Array.from(set).sort()

  }, [workouts])



  const renameExerciseGlobally = async () => {

    if (!db || !userId || !renameOldName.trim() || !renameNewName.trim()) {

      showNotification('Completa ambos campos.', 'warning')

      return

    }

    if (renameOldName.trim() === renameNewName.trim()) {

      setShowRenameModal(false)

      setRenameOldName('')

      setRenameNewName('')

      return

    }

    try {

      let updated = 0

      for (const workout of workouts) {

        if (workout.isRestDay) continue

        const hasExercise = workout.exercises.some(ex => ex.name === renameOldName.trim())

        if (!hasExercise) continue

        const updatedExercises = workout.exercises.map(ex =>

          ex.name === renameOldName.trim() ? { ...ex, name: renameNewName.trim() } : ex

        )

        const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'workouts', workout.date)

        await setDoc(docRef, { ...workout, exercises: updatedExercises }, { merge: true })

        updated++

      }

      setWorkouts(prev => prev.map(w => {

        if (w.isRestDay) return w

        const hasExercise = w.exercises.some(ex => ex.name === renameOldName.trim())

        if (!hasExercise) return w

        return {

          ...w,

          exercises: w.exercises.map(ex =>

            ex.name === renameOldName.trim() ? { ...ex, name: renameNewName.trim() } : ex

          )

        }

      }))

      setShowRenameModal(false)

      setRenameOldName('')

      setRenameNewName('')

      showNotification(`Ejercicio renombrado en ${updated} entrenamiento(s).`, 'success')

    } catch (error) {

      console.error('Error renaming exercise', error)

      showNotification('Error al renombrar el ejercicio.', 'error')

    }

  }



  const updateSet = (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => {

    if (!userId) {

      setShowAuthModal(true)

      return

    }

    const newExercises = [...currentExercises]

    newExercises[exerciseIndex].sets[setIndex][field] = value

    setCurrentExercises(newExercises)

  }



  const addSet = (exerciseIndex: number) => {

    if (!userId) {

      setShowAuthModal(true)

      return

    }

    const newExercises = [...currentExercises]

    newExercises[exerciseIndex].sets.push({ weight: '', reps: '' })

    setCurrentExercises(newExercises)

  }



  const removeSet = (exerciseIndex: number, setIndex: number) => {

    if (!userId) {

      setShowAuthModal(true)

      return

    }

    const newExercises = [...currentExercises]

    newExercises[exerciseIndex].sets.splice(setIndex, 1)

    setCurrentExercises(newExercises)

  }



  const saveWorkout = async () => {

    if (!db || !userId) {

      if (!userId) setShowAuthModal(true)

      else showNotification('Error: La base de datos no está lista. Intenta de nuevo.', 'error')

      return

    }



    // Validar que la fecha no sea futura

    const today = formatDate(getTodayBogota())

    if (logDate > today) {

      showNotification('No puedes registrar entrenamientos en el futuro. Solo hasta el día de hoy.', 'warning')

      return

    }



    const newWorkout: Workout = {

      id: Date.now(),

      date: logDate,

      split: selectedSplit,

      exercises: currentExercises

        .map(ex => ({

          ...ex,

          sets: ex.sets

            .filter(s => parseFloat(s.weight) > 0 && parseFloat(s.reps) > 0)

        }))

        .filter(ex => ex.sets.length > 0),

      isRestDay: false

    }



    if (newWorkout.exercises.length === 0) {

      showNotification('Por favor, agrega al menos un set válido para guardar el entrenamiento.', 'warning')

      return

    }



    try {

      // Validar formato de fecha

      if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {

        showNotification('Error: Formato de fecha inválido. Por favor, selecciona una fecha válida.', 'error')

        return

      }



      console.log('Intentando guardar workout:', {

        userId,

        logDate,

        workout: newWorkout,

        exercisesCount: newWorkout.exercises.length

      })

      

      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'workouts', logDate)

      console.log('Referencia del documento:', docRef.path)

      

      // Usar merge: true para evitar errores si el documento ya existe

      await setDoc(docRef, newWorkout, { merge: true })

      console.log('Workout guardado exitosamente')

      

      showNotification('¡Entrenamiento guardado exitosamente!', 'success')

      setView('calendar')

      setCurrentExercises([])

    } catch (error: any) {

      console.error('Error saving workout to Firestore', error)

      const errorMessage = error?.message || 'Error desconocido'

      const errorCode = error?.code || 'unknown'

      console.error('Error code:', errorCode)

      console.error('Error message:', errorMessage)

      

      // Mensajes más específicos según el código de error

      let userMessage = `Error al guardar el entrenamiento: ${errorMessage}`

      if (errorCode === 'permission-denied') {

        userMessage = 'Error: No tienes permisos para guardar. Verifica las reglas de seguridad de Firestore.'

      } else if (errorCode === 'unavailable') {

        userMessage = 'Error: Firestore no está disponible. Verifica tu conexión a internet.'

      } else if (errorCode === 'unauthenticated') {

        userMessage = 'Error: No estás autenticado. Por favor, inicia sesión nuevamente.'

        setShowAuthModal(true)

      }

      

      showNotification(userMessage, 'error')

    }

  }



  // Datos para gráfico por Ejercicio (Max Weight)

  const exerciseChartData = useMemo(() => {

    if (!userId || workouts.length === 0 || !statExercise) return []

    const dataPoints: { date: string; weight: number }[] = []

    workouts

      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      .forEach(workout => {

        workout.exercises.forEach(ex => {

          if (ex.name === statExercise) {

            const maxWeight = Math.max(...ex.sets.map(s => parseFloat(s.weight) || 0))

            if (maxWeight > 0) dataPoints.push({ date: workout.date, weight: maxWeight })

          }

        })

      })

    return dataPoints

  }, [statExercise, userId, workouts])





  // Datos para gráfico combinado de todos los splits (Volumen Total) - Cada split independiente

  const combinedSplitChartData = useMemo((): Record<string, Array<{ date: string; volume: number }>> => {

    // Crear datos separados por split - cada split solo tiene sus propios puntos

    const splitData: Record<string, Array<{ date: string; volume: number }>> = {}

    

    // Inicializar arrays vacíos para cada split

    Object.keys(customSplits).forEach(split => {

      splitData[split] = []

    })

    

    if (!userId || workouts.length === 0) return splitData

    

    // Calcular volumen por split y fecha - solo agregar puntos donde hay entrenamiento

    workouts.forEach(workout => {

        const totalVolume = workout.exercises.reduce((acc, ex) => {

          const exerciseVolume = ex.sets.reduce((setAcc, set) => {

            const w = parseFloat(set.weight) || 0

            const r = parseFloat(set.reps) || 0

            return setAcc + (w * r)

          }, 0)

          return acc + exerciseVolume

        }, 0)

        

      if (totalVolume > 0 && splitData[workout.split]) {

        splitData[workout.split].push({

          date: workout.date, 

          volume: Math.round(totalVolume) 

        })

      }

    })

    

    // Ordenar cada array por fecha

    Object.keys(splitData).forEach(split => {

      splitData[split].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    })

    

    return splitData

  }, [userId, workouts])



  // Volumen por semana (últimas 8 semanas) para gráfica de barras

  const weeklyVolumeData = useMemo(() => {

    if (!userId || workouts.length === 0) return []

    const weekMap: Record<string, number> = {}

    const today = getTodayBogota()

    for (let i = 7; i >= 0; i--) {

      const d = new Date(today)

      d.setDate(d.getDate() - 7 * i)

      const weekStart = new Date(d)

      weekStart.setDate(weekStart.getDate() - weekStart.getDay())

      const key = weekStart.toISOString().slice(0, 10)

      weekMap[key] = 0

    }

    workouts.forEach(workout => {

      if (workout.isRestDay) return

      const d = new Date(workout.date + 'T12:00:00')

      const weekStart = new Date(d)

      weekStart.setDate(weekStart.getDate() - weekStart.getDay())

      const key = weekStart.toISOString().slice(0, 10)

      if (weekMap[key] === undefined) return

      const vol = workout.exercises.reduce((acc, ex) => acc + ex.sets.reduce((s, set) => s + (parseFloat(set.weight) || 0) * (parseFloat(set.reps) || 0), 0), 0)

      weekMap[key] += Math.round(vol)

    })

    return Object.entries(weekMap)

      .sort((a, b) => a[0].localeCompare(b[0]))

      .map(([date, volume]) => ({ week: date.slice(5), volume }))

  }, [userId, workouts])



  // Mensajes motivadores

  const motivationalMessages = [

    '¡Sigue así, cada entrenamiento te acerca a tus metas!',

    'La disciplina es la clave del éxito. ¡Sigue entrenando!',

    'Cada día es una oportunidad para ser mejor que ayer.',

    'El progreso no es lineal, pero cada sesión cuenta.',

    'Tu cuerpo puede hacerlo, es tu mente la que necesitas convencer.',

    'La fuerza no viene de lo físico, viene de un espíritu indomable.',

    'El único entrenamiento malo es el que no haces.',

    'La diferencia entre lo imposible y lo posible está en tu determinación.',

    'No esperes a sentirte motivado, actúa y la motivación llegará.',

    'Cada repetición te acerca más a la versión que quieres ser.',

    'El dolor que sientes hoy será la fuerza que sientas mañana.',

    'No te rindas cuando estés cerca. ¡Sigue adelante!',

    'La consistencia supera a la perfección.',

    'Eres más fuerte de lo que crees y más capaz de lo que imaginas.',

    'El éxito es la suma de pequeños esfuerzos repetidos día tras día.'

  ]



  // Obtener saludo según hora del día (Bogotá)

  const getGreeting = (): string => {

    const bogotaDate = getTodayBogota()

    const hour = bogotaDate.getHours()

    if (hour >= 5 && hour < 12) return 'Buenos días'

    if (hour >= 12 && hour < 19) return 'Buenas tardes'

    return 'Buenas noches'

  }



  // Mensaje motivador aleatorio (basado en fecha para que cambie diariamente)

  const getMotivationalMessage = (): string => {

    const today = getTodayBogota()

    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)

    return motivationalMessages[dayOfYear % motivationalMessages.length]

  }



  // Lista de ejercicios con datos (solo los que tienen registros)

  const exercisesWithData = useMemo(() => {

    if (!userId || workouts.length === 0) return []

    const exerciseSet = new Set<string>()

    workouts.forEach(w => {

      w.exercises.forEach(e => {

        // Solo incluir si tiene al menos un set con peso y reps válidos

        const hasValidData = e.sets.some(s => {

          const weight = parseFloat(s.weight) || 0

          const reps = parseFloat(s.reps) || 0

          return weight > 0 && reps > 0

        })

        if (hasValidData) {

          exerciseSet.add(e.name)

        }

      })

    })

    return Array.from(exerciseSet).sort()

  }, [userId, workouts])





  // Estadísticas del Dashboard

  const dashboardStats = useMemo(() => {

    if (!userId || workouts.length === 0) {

      return {

        attendanceRate: 0,

        currentStreak: 0,

        bestStreak: 0,

        totalVolume: 0,

        avgWorkoutsPerWeek: 0,

        mostTrainedSplit: 'N/A',

        progressPercentage: 0,

        lastWeekVolume: 0,

        thisWeekVolume: 0

      }

    }

    

    const restDaysPerWeek = userProfile?.restDaysPerWeek || 0



    const sortedWorkouts = [...workouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const workoutDates = sortedWorkouts.map(w => w.date)

    const uniqueDates = new Set(workoutDates)

    

    // % de Asistencia (últimos 30 días)

    const today = getTodayBogota()

    const thirtyDaysAgo = new Date(today)

    thirtyDaysAgo.setDate(today.getDate() - 30)

    const workoutsLast30Days = sortedWorkouts.filter(w => {

      const workoutDate = new Date(w.date + 'T00:00:00')

      return workoutDate >= thirtyDaysAgo && workoutDate <= today

    })

    const uniqueDatesLast30 = new Set(workoutsLast30Days.map(w => w.date))

    const attendanceRate = Math.round((uniqueDatesLast30.size / 30) * 100)



    // Racha actual (días consecutivos) - Los domingos y días de descanso no cuentan

    let currentStreak = 0

    const todayStr = formatDate(getTodayBogota())

    let checkDate = new Date(getTodayBogota())

    

    // Si hay entrenamiento o descanso hoy, empieza desde hoy, sino desde ayer

    const hasTodayWorkout = uniqueDates.has(todayStr)

    const todayWorkout = workouts.find(w => w.date === todayStr)

    const isTodayRestDay = todayWorkout?.isRestDay === true

    

    if (!hasTodayWorkout && !isTodayRestDay) {

      checkDate.setDate(checkDate.getDate() - 1)

    }

    

    // Saltar domingos al inicio si es necesario

    while (checkDate.getDay() === 0 && checkDate >= new Date(sortedWorkouts[0].date)) {

      checkDate.setDate(checkDate.getDate() - 1)

    }

    

    let restDaysUsed = 0

    const weekStart = new Date(checkDate)

    weekStart.setDate(checkDate.getDate() - checkDate.getDay()) // Lunes de la semana

    

    while (checkDate >= new Date(sortedWorkouts[0].date)) {

      const dayOfWeek = checkDate.getDay()

      

      // Saltar domingos (día 0)

      if (dayOfWeek === 0) {

        checkDate.setDate(checkDate.getDate() - 1)

        continue

      }

      

      const checkDateStr = formatDate(checkDate)

      const workoutOnDate = workouts.find(w => w.date === checkDateStr)

      const isRestDay = workoutOnDate?.isRestDay === true

      

      if (uniqueDates.has(checkDateStr)) {

        // Si es día de descanso, no cuenta pero no rompe la racha

        if (isRestDay) {

          // Verificar si está dentro del límite de días de descanso por semana

          const currentWeekStart = new Date(checkDate)

          currentWeekStart.setDate(checkDate.getDate() - checkDate.getDay())

          

          if (currentWeekStart.getTime() !== weekStart.getTime()) {

            restDaysUsed = 0

            weekStart.setTime(currentWeekStart.getTime())

          }

          

          if (restDaysUsed < restDaysPerWeek) {

            restDaysUsed++

            checkDate.setDate(checkDate.getDate() - 1)

            // Saltar domingos después de contar un día

            while (checkDate.getDay() === 0 && checkDate >= new Date(sortedWorkouts[0].date)) {

              checkDate.setDate(checkDate.getDate() - 1)

            }

            continue

          } else {

            // Se excedió el límite de días de descanso, rompe la racha

            break

          }

        } else {

          // Es un entrenamiento real, cuenta para la racha

          currentStreak++

          restDaysUsed = 0 // Resetear contador de descansos

          checkDate.setDate(checkDate.getDate() - 1)

          

          // Saltar domingos después de contar un día

          while (checkDate.getDay() === 0 && checkDate >= new Date(sortedWorkouts[0].date)) {

            checkDate.setDate(checkDate.getDate() - 1)

          }

        }

      } else {

        // No hay entrenamiento ni descanso, rompe la racha

        break

      }

    }



    // Mejor racha - Los domingos no cuentan

    let bestStreak = 0

    let tempStreak = 0

    const allDates = Array.from(uniqueDates)

      .filter(date => {

        const d = new Date(date)

        return d.getDay() !== 0 // Excluir domingos

      })

      .sort()

    

    for (let i = 0; i < allDates.length; i++) {

      const currentDate = new Date(allDates[i])

      const prevDate = i > 0 ? new Date(allDates[i - 1]) : null

      

      if (prevDate) {

        // Calcular días de diferencia excluyendo domingos

        let daysDiff = 0

        let tempDate = new Date(prevDate)

        tempDate.setDate(tempDate.getDate() + 1)

        

        while (tempDate < currentDate) {

          if (tempDate.getDay() !== 0) { // No contar domingos

            daysDiff++

          }

          tempDate.setDate(tempDate.getDate() + 1)

        }

        

        // Si la diferencia es 1 día (excluyendo domingos), es consecutivo

        if (daysDiff === 1 || (daysDiff === 0 && currentDate.getDay() !== 0 && prevDate.getDay() !== 0)) {

          tempStreak++

        } else {

          bestStreak = Math.max(bestStreak, tempStreak)

          tempStreak = 1

        }

      } else {

        tempStreak = 1

      }

    }

    bestStreak = Math.max(bestStreak, tempStreak)



    // Volumen total

    const totalVolume = sortedWorkouts.reduce((acc, workout) => {

      return acc + workout.exercises.reduce((exAcc, ex) => {

        return exAcc + ex.sets.reduce((setAcc, set) => {

          const w = parseFloat(set.weight) || 0

          const r = parseFloat(set.reps) || 0

          return setAcc + (w * r)

        }, 0)

      }, 0)

    }, 0)



    // Split más entrenado

    const splitCounts: Record<string, number> = {}

    workouts.forEach(w => {

      splitCounts[w.split] = (splitCounts[w.split] || 0) + 1

    })

    const mostTrainedSplit = Object.entries(splitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'



    // Progreso: Comparar última semana vs semana anterior

    const oneWeekAgo = new Date(today)

    oneWeekAgo.setDate(today.getDate() - 7)

    const twoWeeksAgo = new Date(today)

    twoWeeksAgo.setDate(today.getDate() - 14)



    const thisWeekWorkouts = sortedWorkouts.filter(w => {

      const workoutDate = new Date(w.date + 'T00:00:00')

      return workoutDate >= oneWeekAgo && workoutDate <= today

    })



    const lastWeekWorkouts = sortedWorkouts.filter(w => {

      const workoutDate = new Date(w.date + 'T00:00:00')

      return workoutDate >= twoWeeksAgo && workoutDate < oneWeekAgo

    })



    const calculateWeekVolume = (weekWorkouts: Workout[]) => {

      return weekWorkouts.reduce((acc, workout) => {

        return acc + workout.exercises.reduce((exAcc, ex) => {

          return exAcc + ex.sets.reduce((setAcc, set) => {

            const w = parseFloat(set.weight) || 0

            const r = parseFloat(set.reps) || 0

            return setAcc + (w * r)

          }, 0)

        }, 0)

      }, 0)

    }



    const thisWeekVolume = calculateWeekVolume(thisWeekWorkouts)

    const lastWeekVolume = calculateWeekVolume(lastWeekWorkouts)

    const progressPercentage = lastWeekVolume > 0 

      ? Math.round(((thisWeekVolume - lastWeekVolume) / lastWeekVolume) * 100)

      : thisWeekVolume > 0 ? 100 : 0



    // Promedio de entrenamientos por semana (corregido)

    const daysDiff = sortedWorkouts.length > 0 

      ? Math.max(1, Math.floor((today.getTime() - new Date(sortedWorkouts[0].date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)))

      : 1

    const weeks = daysDiff / 7

    const avgWorkoutsPerWeek = weeks > 0 ? parseFloat((workouts.length / weeks).toFixed(1)) : workouts.length



    return {

      attendanceRate,

      currentStreak,

      bestStreak,

      totalVolume: Math.round(totalVolume),

      avgWorkoutsPerWeek,

      mostTrainedSplit,

      progressPercentage,

      lastWeekVolume: Math.round(lastWeekVolume),

      thisWeekVolume: Math.round(thisWeekVolume)

    }

  }, [userId, workouts, userProfile])



  // Estadísticas de Récords

  const recordsStats = useMemo(() => {

    if (!userId || workouts.length === 0) {

      return {

        maxWeightByExercise: {},

        maxVolumeByExercise: {},

        maxRepsByExercise: {},

        personalRecords: []

      }

    }



    const maxWeightByExercise: Record<string, { weight: number; date: string; reps: number }> = {}

    const maxVolumeByExercise: Record<string, { volume: number; date: string }> = {}

    const maxRepsByExercise: Record<string, { reps: number; date: string; weight: number }> = {}



    workouts.forEach(workout => {

      workout.exercises.forEach(ex => {

        // Máximo peso

        ex.sets.forEach(set => {

          const weight = parseFloat(set.weight) || 0

          const reps = parseFloat(set.reps) || 0

          if (weight > 0 && reps > 0) {

            if (!maxWeightByExercise[ex.name] || weight > maxWeightByExercise[ex.name].weight) {

              maxWeightByExercise[ex.name] = { weight, date: workout.date, reps }

            }

            // Máximo reps

            if (!maxRepsByExercise[ex.name] || reps > maxRepsByExercise[ex.name].reps) {

              maxRepsByExercise[ex.name] = { reps, date: workout.date, weight }

            }

          }

        })



        // Máximo volumen por ejercicio

        const exerciseVolume = ex.sets.reduce((acc, set) => {

          const w = parseFloat(set.weight) || 0

          const r = parseFloat(set.reps) || 0

          return acc + (w * r)

        }, 0)



        if (!maxVolumeByExercise[ex.name] || exerciseVolume > maxVolumeByExercise[ex.name].volume) {

          maxVolumeByExercise[ex.name] = { volume: exerciseVolume, date: workout.date }

        }

      })

    })



    const personalRecords = Object.keys(maxWeightByExercise).map(exName => ({

      exercise: exName,

      maxWeight: maxWeightByExercise[exName],

      maxVolume: maxVolumeByExercise[exName],

      maxReps: maxRepsByExercise[exName]

    })).sort((a, b) => b.maxWeight.weight - a.maxWeight.weight)



    return {

      maxWeightByExercise,

      maxVolumeByExercise,

      maxRepsByExercise,

      personalRecords

    }

  }, [userId, workouts])



  // Estadísticas de Volumen por Ejercicio

  const volumeByExerciseStats = useMemo(() => {

    if (!userId || workouts.length === 0) return []



    const exerciseVolumes: Record<string, { total: number; sessions: number; avg: number }> = {}



    workouts.forEach(workout => {

      workout.exercises.forEach(ex => {

        const exerciseVolume = ex.sets.reduce((acc, set) => {

          const w = parseFloat(set.weight) || 0

          const r = parseFloat(set.reps) || 0

          return acc + (w * r)

        }, 0)



        if (!exerciseVolumes[ex.name]) {

          exerciseVolumes[ex.name] = { total: 0, sessions: 0, avg: 0 }

        }

        exerciseVolumes[ex.name].total += exerciseVolume

        exerciseVolumes[ex.name].sessions += 1

      })

    })



    return Object.entries(exerciseVolumes)

      .map(([name, data]) => ({

        name,

        totalVolume: Math.round(data.total),

        sessions: data.sessions,

        avgVolume: Math.round(data.total / data.sessions)

      }))

      .sort((a, b) => b.totalVolume - a.totalVolume)

  }, [userId, workouts])



  // Estadísticas de Rendimiento (mejoras recientes) - Mejorado

  const performanceStats = useMemo(() => {

    if (!userId || workouts.length === 0) {

      return {

        improvingExercises: [],

        decliningExercises: [],

        newExercises: [],

        exerciseTrends: []

      }

    }



    const sortedWorkouts = [...workouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    

    // Comparar últimos 30 días vs anteriores 30 días

    const today = getTodayBogota()

    const thirtyDaysAgo = new Date(today)

    thirtyDaysAgo.setDate(today.getDate() - 30)

    const sixtyDaysAgo = new Date(today)

    sixtyDaysAgo.setDate(today.getDate() - 60)



    const recentWorkouts = sortedWorkouts.filter(w => {

      const workoutDate = new Date(w.date + 'T00:00:00')

      return workoutDate >= thirtyDaysAgo && workoutDate <= today

    })

    

    const olderWorkouts = sortedWorkouts.filter(w => {

      const workoutDate = new Date(w.date + 'T00:00:00')

      return workoutDate >= sixtyDaysAgo && workoutDate < thirtyDaysAgo

    })



    const recentStats: Record<string, { maxWeight: number; totalVolume: number; sessions: number; avgVolume: number }> = {}

    const olderStats: Record<string, { maxWeight: number; totalVolume: number; sessions: number; avgVolume: number }> = {}

    const allExercises = new Set<string>()



    // Calcular estadísticas recientes

    recentWorkouts.forEach(workout => {

      workout.exercises.forEach(ex => {

        allExercises.add(ex.name)

        const maxWeight = Math.max(...ex.sets.map(s => parseFloat(s.weight) || 0))

        const exerciseVolume = ex.sets.reduce((acc, set) => {

          const w = parseFloat(set.weight) || 0

          const r = parseFloat(set.reps) || 0

          return acc + (w * r)

        }, 0)



        if (!recentStats[ex.name]) {

          recentStats[ex.name] = { maxWeight: 0, totalVolume: 0, sessions: 0, avgVolume: 0 }

        }

        if (maxWeight > recentStats[ex.name].maxWeight) {

          recentStats[ex.name].maxWeight = maxWeight

        }

        recentStats[ex.name].totalVolume += exerciseVolume

        recentStats[ex.name].sessions += 1

      })

    })



    // Calcular estadísticas antiguas

    olderWorkouts.forEach(workout => {

      workout.exercises.forEach(ex => {

        const maxWeight = Math.max(...ex.sets.map(s => parseFloat(s.weight) || 0))

        const exerciseVolume = ex.sets.reduce((acc, set) => {

          const w = parseFloat(set.weight) || 0

          const r = parseFloat(set.reps) || 0

          return acc + (w * r)

        }, 0)



        if (!olderStats[ex.name]) {

          olderStats[ex.name] = { maxWeight: 0, totalVolume: 0, sessions: 0, avgVolume: 0 }

        }

        if (maxWeight > olderStats[ex.name].maxWeight) {

          olderStats[ex.name].maxWeight = maxWeight

        }

        olderStats[ex.name].totalVolume += exerciseVolume

        olderStats[ex.name].sessions += 1

      })

    })



    // Calcular promedios

    Object.keys(recentStats).forEach(exName => {

      if (recentStats[exName].sessions > 0) {

        recentStats[exName].avgVolume = recentStats[exName].totalVolume / recentStats[exName].sessions

      }

    })

    Object.keys(olderStats).forEach(exName => {

      if (olderStats[exName].sessions > 0) {

        olderStats[exName].avgVolume = olderStats[exName].totalVolume / olderStats[exName].sessions

      }

    })



    const improvingExercises: Array<{ name: string; improvement: number; oldMax: number; newMax: number; type: 'weight' | 'volume' }> = []

    const decliningExercises: Array<{ name: string; decline: number; oldMax: number; newMax: number; type: 'weight' | 'volume' }> = []

    const newExercises: string[] = []

    const exerciseTrends: Array<{ name: string; weightChange: number; volumeChange: number; sessionsChange: number }> = []



    allExercises.forEach(exName => {

      const recent = recentStats[exName] || { maxWeight: 0, totalVolume: 0, sessions: 0, avgVolume: 0 }

      const older = olderStats[exName] || { maxWeight: 0, totalVolume: 0, sessions: 0, avgVolume: 0 }



      if (recent.maxWeight > 0 && older.maxWeight === 0) {

        newExercises.push(exName)

      } else if (recent.maxWeight > 0 && older.maxWeight > 0) {

        const weightChange = ((recent.maxWeight - older.maxWeight) / older.maxWeight) * 100

        const volumeChange = older.avgVolume > 0 ? ((recent.avgVolume - older.avgVolume) / older.avgVolume) * 100 : 0

        const sessionsChange = older.sessions > 0 ? ((recent.sessions - older.sessions) / older.sessions) * 100 : 100



        exerciseTrends.push({

          name: exName,

          weightChange: Math.round(weightChange),

          volumeChange: Math.round(volumeChange),

          sessionsChange: Math.round(sessionsChange)

        })



        if (weightChange > 5) {

          improvingExercises.push({

            name: exName,

            improvement: Math.round(weightChange),

            oldMax: older.maxWeight,

            newMax: recent.maxWeight,

            type: 'weight'

          })

        } else if (volumeChange > 10) {

          improvingExercises.push({

            name: exName,

            improvement: Math.round(volumeChange),

            oldMax: older.avgVolume,

            newMax: recent.avgVolume,

            type: 'volume'

          })

        } else if (weightChange < -5) {

          decliningExercises.push({

            name: exName,

            decline: Math.round(Math.abs(weightChange)),

            oldMax: older.maxWeight,

            newMax: recent.maxWeight,

            type: 'weight'

          })

        } else if (volumeChange < -10) {

          decliningExercises.push({

            name: exName,

            decline: Math.round(Math.abs(volumeChange)),

            oldMax: older.avgVolume,

            newMax: recent.avgVolume,

            type: 'volume'

          })

        }

      }

    })



    return {

      improvingExercises: improvingExercises.sort((a, b) => b.improvement - a.improvement),

      decliningExercises: decliningExercises.sort((a, b) => b.decline - a.decline),

      newExercises,

      exerciseTrends: exerciseTrends.sort((a, b) => Math.abs(b.weightChange) - Math.abs(a.weightChange))

    }

  }, [userId, workouts])



  // Paleta premium: Glassmorphism con Naranja Energético

  const bgMain = isDarkMode ? 'bg-[#0f0d0c]' : 'bg-orange-50/30'

  const bgCard = isDarkMode ? 'bg-zinc-900/70 backdrop-blur-2xl border border-orange-500/10' : 'bg-white/80 backdrop-blur-2xl border border-orange-200/50'

  const bgCardHover = isDarkMode ? 'bg-zinc-800/70 border-orange-500/20' : 'bg-orange-50/80 border-orange-300/50'

  const textMain = isDarkMode ? 'text-zinc-100' : 'text-zinc-900'

  const textSecondary = isDarkMode ? 'text-zinc-400' : 'text-zinc-600'

  const textMuted = isDarkMode ? 'text-zinc-500' : 'text-zinc-500'

  const borderMain = isDarkMode ? 'border-orange-500/10' : 'border-orange-200/50'

  const borderSecondary = isDarkMode ? 'border-orange-500/15' : 'border-orange-300/50'

  const inputBg = isDarkMode ? 'bg-zinc-800/80' : 'bg-white/70'

  const inputBorder = isDarkMode ? 'border-orange-500/20' : 'border-orange-300/50'

  const btnPrimary = isDarkMode ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/30' : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/35'



  if (isLoading) {

    return (

      <div className={`min-h-screen ${bgMain} ${textMain} flex items-center justify-center`}>

        <div className={`flex flex-col items-center p-8 ${bgCard} rounded-2xl shadow-2xl border ${borderMain}`}>

          <Loader className={`w-10 h-10 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'} animate-spin`} />

          <p className="mt-4 text-lg font-semibold">Cargando aplicación...</p>

          <p className={`text-sm ${textMuted} mt-1`}>Verificando sesión persistente...</p>

        </div>

      </div>

    )

  }



  const AuthModal = () => (

    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-md">

      <div className={`${bgCard} border ${borderSecondary} rounded-2xl p-8 max-w-sm w-full shadow-2xl transform transition-all scale-100`}>

        <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/20' : 'bg-gradient-to-br from-orange-100 to-amber-100'} flex items-center justify-center`}>

          <Dumbbell className={`w-8 h-8 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />

        </div>

        <h2 className={`text-2xl font-bold ${textMain} text-center mb-2`}>Bienvenido a Arnold Tracker</h2>

        <p className={`${textSecondary} text-center mb-6`}>

          Para guardar tu progreso de entrenamiento de forma persistente y no perder tus récords, por favor, inicia sesión.

        </p>

        <button onClick={signInWithGoogle} className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-0.5">

          <svg className="w-5 h-5" viewBox="0 0 48 48" >

            <path fill="#FFC107" d="M43.61 20.08v3.42H24V20.08z" />

            <path fill="#FF3D00" d="M6.39 20.08V23.5H24V20.08z" />

            <path fill="#4CAF50" d="M6.39 30.22v3.42H24V30.22z" />

            <path fill="#1976D2" d="M43.61 30.22V33.64H24V30.22z" />

            <path fill="#2196F3" d="M24 6.39C14.7 6.39 6.39 14.7 6.39 24s8.31 17.61 17.61 17.61 17.61-8.31 17.61-17.61H24z" />

            <path fill="#BBDEFB" d="M24 6.39c8.31 0 15.22 5.09 16.94 12.08H24z" />

          </svg>

          Iniciar Sesión con Google

        </button>

        <p className={`text-xs ${textMuted} text-center mt-4`}>Tus datos serán guardados en tu cuenta de Google.</p>

      </div>

    </div>

  )



  const NotificationToast = () => {

    if (!notification) return null



    const bgColors = {

      success: isDarkMode ? 'bg-green-600/90 border-green-500/50 backdrop-blur-xl' : 'bg-green-500/90 border-green-400/50 backdrop-blur-xl',

      error: isDarkMode ? 'bg-red-600/90 border-red-500/50 backdrop-blur-xl' : 'bg-red-500/90 border-red-400/50 backdrop-blur-xl',

      warning: isDarkMode ? 'bg-amber-600/90 border-amber-500/50 backdrop-blur-xl' : 'bg-amber-500/90 border-amber-400/50 backdrop-blur-xl',

      info: isDarkMode ? 'bg-orange-600/90 border-orange-500/50 backdrop-blur-xl' : 'bg-orange-500/90 border-orange-400/50 backdrop-blur-xl'

    }



    const icons = {

      success: <Activity className="w-5 h-5" />,

      error: <Activity className="w-5 h-5" />,

      warning: <Activity className="w-5 h-5" />,

      info: <Cloud className="w-5 h-5" />

    }



    return (

      <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-right fade-in duration-300">

        <div className={`${bgColors[notification.type]} text-white px-6 py-4 rounded-lg shadow-2xl border-2 flex items-center gap-3 min-w-[300px] max-w-md`}>

          <div className="flex-shrink-0">

            {icons[notification.type]}

          </div>

          <p className="flex-1 font-medium">{notification.message}</p>

          <button 

            onClick={() => setNotification(null)}

            className="flex-shrink-0 hover:opacity-70 transition-opacity"

          >

            ✕

          </button>

        </div>

      </div>

    )

  }



  const DeleteConfirmationModal = () => {

    if (!showDeleteModal) return null



    const isSplit = deleteModalType === 'split'

    const title = isSplit ? 'Eliminar Split' : 'Eliminar Entrenamiento'

    const message = isSplit 

      ? `¿Estás seguro de que quieres eliminar el split "${splitToDelete}"? Esta acción no se puede deshacer.`

      : '¿Estás seguro de que quieres eliminar este entrenamiento? Podrás registrarlo nuevamente o marcarlo como descanso.'



    return (

      <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">

        <div className={`${bgCard} border ${borderSecondary} rounded-xl p-6 max-w-sm w-full shadow-2xl`}>

          <div className="flex items-center gap-3 mb-4">

            <div className={`p-3 rounded-full ${isDarkMode ? 'bg-red-900/30' : 'bg-red-100'}`}>

              <Trash2 className={`w-6 h-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />

            </div>

            <h2 className={`text-xl font-bold ${textMain}`}>{title}</h2>

          </div>

          <p className={`${textSecondary} mb-6`}>

            {message}

          </p>

          <div className="flex gap-3">

            <button

              onClick={() => {

                setShowDeleteModal(false)

                setWorkoutToDelete(null)

                setSplitToDelete(null)

                setDeleteModalType('workout')

              }}

              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}

            >

              Cancelar

            </button>

            <button

              onClick={isSplit ? deleteSplit : deleteWorkout}

              className="flex-1 py-2 px-4 rounded-lg font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"

            >

              Eliminar

            </button>

          </div>

        </div>

      </div>

    )

  }



  const RenameExerciseModal = () => {

    if (!showRenameModal) return null

    return (

      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">

        <div className={`${bgCard} border ${borderMain} rounded-2xl p-6 max-w-md w-full shadow-2xl`}>

          <h2 className={`text-xl font-bold ${textMain} mb-4 flex items-center gap-2`}>

            <Edit2 className="w-5 h-5" />

            Renombrar ejercicio en todo el historial

          </h2>

          <p className={`text-sm ${textSecondary} mb-4`}>

            Si escribiste mal el nombre de un ejercicio, aquí puedes corregirlo en todos los entrenamientos de una vez.

          </p>

          <div className="space-y-4">

            <div>

              <label className={`block text-sm ${textSecondary} mb-2`}>Ejercicio a renombrar</label>

              <select

                value={renameOldName}

                onChange={(e) => setRenameOldName(e.target.value)}

                className={`w-full ${inputBg} ${textMain} p-3 rounded-xl border ${inputBorder} focus:outline-none focus:ring-2 focus:ring-emerald-500/50`}

              >

                <option value="">Selecciona...</option>

                {allUniqueExerciseNames.map((name) => (

                  <option key={name} value={name}>{name}</option>

                ))}

              </select>

            </div>

            <div>

              <label className={`block text-sm ${textSecondary} mb-2`}>Nuevo nombre</label>

              <input

                type="text"

                value={renameNewName}

                onChange={(e) => setRenameNewName(e.target.value)}

                placeholder="Ej: Press Banca"

                className={`w-full ${inputBg} ${textMain} p-3 rounded-xl border ${inputBorder} focus:outline-none focus:ring-2 focus:ring-emerald-500/50`}

              />

            </div>

          </div>

          <div className="flex gap-3 mt-6">

            <button

              onClick={() => { setShowRenameModal(false); setRenameOldName(''); setRenameNewName(''); }}

              className={`flex-1 py-2.5 px-4 rounded-xl font-medium ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}

            >

              Cancelar

            </button>

            <button

              onClick={renameExerciseGlobally}

              disabled={!renameOldName.trim() || !renameNewName.trim()}

              className="flex-1 py-2.5 px-4 rounded-xl font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"

            >

              Renombrar

            </button>

          </div>

        </div>

      </div>

    )

  }



  const renderCalendar = (): React.ReactElement[] => {

    const year = selectedDate.getFullYear()

    const month = selectedDate.getMonth()

    const daysInMonth = getDaysInMonth(year, month)

    const firstDay = getFirstDayOfMonth(year, month)

    const days: React.ReactElement[] = []



    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16" />)



    for (let day = 1; day <= daysInMonth; day++) {

      const currentDayString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      const todayString = formatDate(getTodayBogota())

      const isFutureDate = currentDayString > todayString



      const workoutOnDay = workouts.find(w => w.date === currentDayString)

      let bgClass = isDarkMode 

        ? `${bgCardHover} hover:${bgCard} ${textSecondary}` 

        : `${bgCardHover} hover:${bgCard} ${textSecondary}`



      if (userId && workoutOnDay) {

        if (workoutOnDay.isRestDay) {

          bgClass = isDarkMode 

            ? 'bg-emerald-900/50 border border-emerald-500 text-emerald-200 font-bold' 

            : 'bg-emerald-200 border border-emerald-400 text-emerald-800 font-bold'

        } else {

          const splitIndex = Object.keys(customSplits).indexOf(workoutOnDay.split)

          const splitColor = generateSplitColor(workoutOnDay.split, splitIndex)

          const colorClasses = getSplitColorClasses(splitColor, isDarkMode)

          bgClass = `${colorClasses.bg} border ${colorClasses.border} ${colorClasses.text} font-bold`

        }

      }



      days.push(

        <button

          key={day}

          onClick={() => {

            if (!userId) {

              setShowAuthModal(true)

              return

            }

            if (isFutureDate) {

              showNotification('No puedes seleccionar fechas futuras.', 'warning')

              return

            }

            setLogDate(currentDayString)

            setView('log')

          }}

          className={`h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 rounded-lg flex items-center justify-center text-xs sm:text-sm md:text-base font-medium transition-all ${bgClass} ${isFutureDate ? 'opacity-40 cursor-not-allowed' : ''}`}

          disabled={isFutureDate}

        >

          {day}

        </button>

      )

    }



    return days

  }



  return (

    <div className={`min-h-screen ${bgMain} ${textMain} font-sans pb-20 md:pb-0 transition-colors duration-300 relative antialiased`}>

      {/* Fondo premium: Glassmorphism con gradiente cálido naranja/coral */}

      <div className={`fixed inset-0 -z-10 ${isDarkMode ? 'bg-[#0d0a08]' : 'bg-orange-50/50'}`} />

      <div className={`fixed inset-0 -z-10 ${isDarkMode ? 'bg-gradient-to-b from-orange-950/30 via-transparent to-rose-950/20' : 'bg-gradient-to-b from-orange-100/50 via-transparent to-amber-50/30'}`} />

      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--tw-gradient-stops))] from-orange-500/8 via-transparent to-transparent" />

      <style>{`

        @keyframes fadeIn {

          from {

            opacity: 0;

            transform: translateY(10px);

          }

          to {

            opacity: 1;

            transform: translateY(0);

          }

        }

        .animate-fade-in {

          animation: fadeIn 0.6s ease-out forwards;

        }

      `}</style>

      {showAuthModal && <AuthModal />}

      <NotificationToast />

      <DeleteConfirmationModal />

      <RenameExerciseModal />



      <header className={`sticky top-0 z-10 md:ml-20 ${isDarkMode ? 'bg-zinc-900/80 backdrop-blur-2xl border-b border-orange-500/10' : 'bg-white/80 backdrop-blur-2xl border-b border-orange-200/50'} px-4 py-3 transition-colors ${showAuthModal ? 'pointer-events-none' : ''}`}>

        <div className="max-w-4xl mx-auto flex justify-between items-center">

          <div className="flex items-center gap-3">

            <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/20' : 'bg-gradient-to-br from-orange-100 to-amber-100'} flex items-center justify-center`}>

              <Dumbbell className={`w-6 h-6 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />

            </div>

            <div>

              <h1 className={`text-lg font-bold ${textMain}`}>Arnold Tracker</h1>

              {user && (

                <p className={`text-xs ${textSecondary} hidden sm:block`}>

                  {getGreeting()}, {user.displayName?.split(' ')[0]}

                </p>

              )}

            </div>

          </div>

          <div className="flex items-center gap-2">

            <button

              onClick={toggleDarkMode}

              className={`p-2.5 rounded-xl transition-colors ${isDarkMode ? 'text-slate-400 hover:text-amber-400 hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}

              title={isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}

            >

              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}

            </button>

            {user ? (

              <button onClick={handleSignOut} className={`p-2.5 rounded-xl transition-colors hidden md:flex items-center gap-2 ${isDarkMode ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-600 hover:text-red-600 hover:bg-red-50'}`} title="Cerrar Sesión">

                <LogOut className="w-5 h-5" />

              </button>

            ) : (

              <button onClick={() => setShowAuthModal(true)} className={`${btnPrimary} font-semibold py-2.5 px-4 rounded-xl text-sm flex items-center gap-2 transition-all`}>

                <LogIn className="w-4 h-4" />

                Iniciar

              </button>

            )}

          </div>

        </div>

      </header>



      {/* Contenido principal */}

      <main className={`max-w-4xl mx-auto md:ml-20 p-4 ${showAuthModal ? 'pointer-events-none opacity-50' : ''}`}>

        {!userId && isAuthReady && (

          <div className="bg-yellow-900/50 text-yellow-300 p-3 rounded-lg mb-6 border border-yellow-700 flex items-center justify-center gap-2">

            <User className="w-5 h-5" />

            <p className="text-sm font-medium">Inicia sesión para guardar y ver tu progreso.</p>

          </div>

        )}



        {/* Dashboard */}

        {view === 'dashboard' && (

          <div className="space-y-6">

            {/* Hero card: mensaje motivador con gradiente naranja */}

            {user && (

              <div className={`relative overflow-hidden rounded-3xl p-6 animate-in fade-in slide-in-from-top duration-500 ${isDarkMode ? 'bg-gradient-to-br from-orange-500/90 via-orange-600/80 to-rose-600/70 border border-orange-400/20 shadow-2xl shadow-orange-500/20' : 'bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 border border-orange-400/30 shadow-2xl shadow-orange-500/25'}`}>

                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />

                <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-300/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />

                <div className="relative flex items-start gap-4">

                  <div className="flex-shrink-0 p-3.5 rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg">

                    <Dumbbell className="w-8 h-8 text-white drop-shadow-md" />

                  </div>

                  <div className="flex-1 min-w-0">

                    <h2 className="text-xl md:text-2xl font-bold text-white mb-1 drop-shadow-sm">

                      {getGreeting()}, {user.displayName?.split(' ')[0]}! 💪

                    </h2>

                    <p className="text-orange-100 text-sm md:text-base">

                      {getMotivationalMessage()}

                    </p>

                    <button

                      onClick={() => { setLogDate(formatDate(getTodayBogota())); setView('log'); }}

                      className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-sm transition-all shadow-lg backdrop-blur-sm hover:shadow-xl hover:-translate-y-0.5"

                    >

                      <Plus className="w-4 h-4" />

                      Registrar hoy

                    </button>

                  </div>

                  {userId && (

                    <div className="hidden sm:flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg">

                      <span className="text-2xl font-bold text-white">{dashboardStats.attendanceRate}</span>

                      <span className="text-[10px] text-orange-100 uppercase font-medium">%</span>

                    </div>

                  )}

                </div>

              </div>

            )}



            {/* Estadísticas Principales: cards con iconos y glass effect */}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

              <div className={`${bgCard} p-5 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/10 animate-in fade-in slide-in-from-bottom duration-500`} style={{ animationDelay: '0ms' }}>

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${isDarkMode ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/20' : 'bg-gradient-to-br from-orange-100 to-amber-100'}`}>

                  <Activity className={`w-5 h-5 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />

                </div>

                <div className={`text-xs ${textSecondary} font-medium uppercase tracking-wider mb-0.5`}>Entrenos</div>

                <div className={`text-2xl font-bold ${textMain}`}>{userId ? workouts.length : '-'}</div>

              </div>

              <div className={`${bgCard} p-5 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-rose-500/10 animate-in fade-in slide-in-from-bottom duration-500`} style={{ animationDelay: '50ms' }}>

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${isDarkMode ? 'bg-gradient-to-br from-rose-500/20 to-pink-500/20' : 'bg-gradient-to-br from-rose-100 to-pink-100'}`}>

                  <Target className={`w-5 h-5 ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`} />

                </div>

                <div className={`text-xs ${textSecondary} font-medium uppercase tracking-wider mb-0.5`}>Asistencia</div>

                <div className={`text-2xl font-bold ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>

                  {userId ? `${dashboardStats.attendanceRate}%` : '-'}

                </div>

                <div className={`text-[10px] ${textMuted} mt-0.5`}>30 días</div>

              </div>

              <div className={`${bgCard} p-5 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-amber-500/10 animate-in fade-in slide-in-from-bottom duration-500`} style={{ animationDelay: '100ms' }}>

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${isDarkMode ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20' : 'bg-gradient-to-br from-amber-100 to-orange-100'}`}>

                  <Flame className={`w-5 h-5 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />

                </div>

                <div className={`text-xs ${textSecondary} font-medium uppercase tracking-wider mb-0.5`}>Racha</div>

                <div className={`text-2xl font-bold ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>

                  {userId ? dashboardStats.currentStreak : '-'}

                </div>

                <div className={`text-[10px] ${textMuted} mt-0.5`}>días</div>

              </div>

              <div className={`${bgCard} p-5 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-yellow-500/10 animate-in fade-in slide-in-from-bottom duration-500`} style={{ animationDelay: '150ms' }}>

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${isDarkMode ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/20' : 'bg-gradient-to-br from-yellow-100 to-amber-100'}`}>

                  <Trophy className={`w-5 h-5 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />

                </div>

                <div className={`text-xs ${textSecondary} font-medium uppercase tracking-wider mb-0.5`}>Mejor racha</div>

                <div className={`text-2xl font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>

                  {userId ? dashboardStats.bestStreak : '-'}

                </div>

                <div className={`text-[10px] ${textMuted} mt-0.5`}>días</div>

              </div>

            </div>



            {/* Estadísticas Secundarias */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <div className={`${bgCard} p-4 rounded-2xl border ${borderMain} hover:border-orange-500/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-orange-500/15 animate-in fade-in slide-in-from-left duration-500`} style={{ animationDelay: '400ms' }}>

                <div className={`${textSecondary} text-sm mb-2 flex items-center gap-2`}>

                  <Zap className={`w-4 h-4 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />

                  Volumen Total

                </div>

                <div className={`text-2xl font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'} transition-all`}>

                  {userId ? `${(dashboardStats.totalVolume / 1000).toFixed(1)}k` : '-'}

                </div>

                <div className={`text-xs ${textMuted} mt-1`}>kg levantados</div>

              </div>

              <div className={`${bgCard} p-4 rounded-2xl border ${borderMain} hover:border-rose-500/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-rose-500/15 animate-in fade-in slide-in-from-bottom duration-500`} style={{ animationDelay: '500ms' }}>

                <div className={`${textSecondary} text-sm mb-2 flex items-center gap-2`}>

                  <Calendar className={`w-4 h-4 ${isDarkMode ? 'text-rose-400' : 'text-rose-500'}`} />

                  Promedio Semanal

                </div>

                <div className={`text-2xl font-bold ${isDarkMode ? 'text-rose-400' : 'text-rose-500'} transition-all`}>

                  {userId ? `${dashboardStats.avgWorkoutsPerWeek}` : '-'}

                </div>

                <div className={`text-xs ${textMuted} mt-1`}>entrenos/semana</div>

              </div>

              <div className={`${bgCard} p-4 rounded-2xl border ${borderMain} hover:border-amber-500/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/15 animate-in fade-in slide-in-from-right duration-500`} style={{ animationDelay: '600ms' }}>

                <div className={`${textSecondary} text-sm mb-2 flex items-center gap-2`}>

                  <BicepsFlexed className={`w-4 h-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`} />

                  Split Favorito

                </div>

                <div className={`text-lg font-bold ${isDarkMode ? 'text-amber-400' : 'text-amber-500'} truncate transition-all`}>

                  {userId ? dashboardStats.mostTrainedSplit : '-'}

                </div>

                <div className={`text-xs ${textMuted} mt-1`}>más entrenado</div>

              </div>

            </div>



            {/* Progreso Semanal */}

            {userId && dashboardStats.thisWeekVolume > 0 && (

              <div className={`${bgCard} p-6 rounded-2xl border ${borderMain} hover:border-orange-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/15 animate-fade-in`} style={{ animationDelay: '700ms' }}>

                <h2 className={`text-lg font-semibold mb-4 ${textMain} flex items-center gap-2`}>

                  {dashboardStats.progressPercentage >= 0 ? (

                    <TrendingUp className={`w-5 h-5 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />

                  ) : (

                    <TrendingDown className="w-5 h-5 text-red-400" />

                  )}

                  Progreso Semanal

                </h2>

                <div className="space-y-4">

                  <div className="flex justify-between items-center">

                    <span className={textSecondary}>Esta semana</span>

                    <span className={`text-xl font-bold ${textMain}`}>

                      {dashboardStats.thisWeekVolume.toLocaleString()} kg

                    </span>

                  </div>

                  <div className="flex justify-between items-center">

                    <span className={textSecondary}>Semana anterior</span>

                    <span className={`text-lg font-semibold ${textSecondary}`}>

                      {dashboardStats.lastWeekVolume.toLocaleString()} kg

                    </span>

                  </div>

                  <div className={`mt-4 pt-4 border-t ${borderSecondary}`}>

                    <div className="flex justify-between items-center">

                      <span className={textSecondary}>Progreso</span>

                      <span className={`text-2xl font-bold ${

                        dashboardStats.progressPercentage >= 0 ? (isDarkMode ? 'text-orange-400' : 'text-orange-600') : 'text-red-400'

                      }`}>

                        {dashboardStats.progressPercentage >= 0 ? '+' : ''}{dashboardStats.progressPercentage}%

                      </span>

                    </div>

                    <div className={`mt-2 h-3 ${bgCardHover} rounded-full overflow-hidden`}>

                      <div 

                        className={`h-full rounded-full transition-all duration-500 ${

                          dashboardStats.progressPercentage >= 0 ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-gradient-to-r from-red-500 to-rose-500'

                        }`}

                        style={{ 

                          width: `${Math.min(100, Math.abs(dashboardStats.progressPercentage))}%`,

                          boxShadow: dashboardStats.progressPercentage >= 0 ? '0 0 20px hsl(24 95% 53% / 0.4)' : '0 0 20px hsl(0 72% 50% / 0.4)'

                        }}

                      />

                    </div>

                  </div>

                </div>

              </div>

            )}



            {/* Actividad Reciente */}

            <div className={`${bgCard} p-6 rounded-2xl border ${borderMain} hover:border-rose-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-rose-500/15 animate-fade-in`} style={{ animationDelay: '800ms' }}>

              <h2 className={`text-lg font-semibold mb-4 ${textMain} flex items-center gap-2`}>

                <Activity className={`w-5 h-5 ${isDarkMode ? 'text-rose-400' : 'text-rose-500'}`} />

                Actividad Reciente

              </h2>

              <div className="space-y-3">

                {userId 

                  ? workouts.length > 0 ? (

                      <>

                        {workouts

                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

                          .filter(w => !w.isRestDay) // Excluir días de descanso

                          .slice(0, showAllActivity ? undefined : 3)

                          .map((workout, index) => {

                            const workoutVolume = workout.exercises.reduce((exAcc, ex) => {

                              return exAcc + ex.sets.reduce((setAcc, set) => {

                                const w = parseFloat(set.weight) || 0

                                const r = parseFloat(set.reps) || 0

                                return setAcc + (w * r)

                              }, 0)

                            }, 0)

                            return (

                              <div key={workout.id} className={`flex justify-between items-center ${bgCardHover} p-3 rounded-lg hover:${bgCardHover} hover:scale-[1.02] transition-all duration-300 animate-in fade-in slide-in-from-right`} style={{ animationDelay: `${index * 100}ms` }}>

                                <div>

                                  <div className={`font-medium ${textMain}`}>{workout.split}</div>

                                  <div className={`text-xs ${textSecondary}`}>{workout.date}</div>

                                </div>

                                <div className="flex items-center gap-3">

                                  <div className={`text-xs ${bgCard} px-2 py-1 rounded ${textSecondary}`}>

                                    {workout.exercises.length} Ejercicios

                                  </div>

                                  <div className={`text-xs ${isDarkMode ? 'text-orange-400' : 'text-orange-600'} font-semibold`}>

                                    {Math.round(workoutVolume)} kg

                                  </div>

                                </div>

                              </div>

                            )

                          })}

                        {workouts.filter(w => !w.isRestDay).length > 3 && (

                          <button

                            onClick={() => setShowAllActivity(!showAllActivity)}

                            className={`w-full py-2 text-sm ${isDarkMode ? 'text-orange-400 hover:text-orange-300' : 'text-orange-600 hover:text-orange-500'} font-medium transition-colors`}

                          >

                            {showAllActivity ? 'Ver menos' : `Ver más (${workouts.filter(w => !w.isRestDay).length - 3} más)`}

                          </button>

                        )}

                      </>

                    ) : (

                      <p className={`${textMuted} italic text-center py-4`}>No hay entrenamientos registrados aún.</p>

                    )

                  : (

                    <p className={`${textMuted} italic text-center py-4`}>Inicia sesión para ver tu actividad.</p>

                  )

                }

              </div>

            </div>



            {/* Último Entreno */}

            {userId && workouts.length > 0 && (

              <div className={`${bgCard} p-4 rounded-2xl border ${borderMain}`}>

                <div className={`${textSecondary} text-sm mb-2`}>Último Entreno</div>

                <div className={`text-lg font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>

                  {workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].split}

                </div>

                <div className={`text-xs ${textMuted} mt-1`}>

                  {workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date}

                </div>

              </div>

            )}



          </div>

        )}



        {/* Calendar */}

        {view === 'calendar' && (

          <div className="space-y-4 animate-fade-in">

            <div className="flex justify-between items-center mb-4">

              <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))} className={`p-2 hover:${bgCardHover} rounded-full ${textSecondary} transition-colors`}>

                <ChevronLeft />

              </button>

              <h2 className={`text-xl font-bold ${textMain} capitalize`}>

                {selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}

              </h2>

              <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))} className={`p-2 hover:${bgCardHover} rounded-full ${textSecondary} transition-colors`}>

                <ChevronRight />

              </button>

            </div>



            <div className={`grid grid-cols-7 gap-3 text-center text-sm font-semibold ${textMuted} mb-3`}>

              <div>D</div><div>L</div><div>M</div><div>X</div><div>J</div><div>V</div><div>S</div>

            </div>



            <div className="grid grid-cols-7 gap-3">

              {renderCalendar()}

            </div>



            <div className={`mt-6 flex flex-wrap gap-3 text-xs justify-center ${textSecondary}`}>

              {Object.keys(customSplits).map((split, index) => {

                const splitColor = generateSplitColor(split, index)

                const colorClasses = getSplitColorClasses(splitColor, isDarkMode)

                return (

                  <div key={split} className="flex items-center gap-1.5">

                    <div className={`w-3 h-3 ${colorClasses.bg} border ${colorClasses.border} rounded`}></div>

                    <span className="text-xs">{split}</span>

                  </div>

                )

              })}

              <div className="flex items-center gap-1.5">

                <div className={`w-3 h-3 ${isDarkMode ? 'bg-emerald-900/50 border-emerald-500' : 'bg-emerald-200 border-emerald-400'} border rounded`}></div>

                <span className="text-xs">Descanso</span>

              </div>

            </div>

          </div>

        )}



        {/* Log */}

        {view === 'log' && (

          <div className="animate-fade-in pb-10">

            <div className="flex justify-between items-center mb-6">

              <h2 className={`text-xl font-bold ${textMain}`}>Registrar Sesión</h2>

              <div className="flex items-center gap-2">

                {userId && workouts.find(w => w.date === logDate) && (

                  <button

                    onClick={() => confirmDeleteWorkout(logDate)}

                    className={`p-2 rounded-lg ${isDarkMode ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400' : 'bg-red-100 hover:bg-red-200 text-red-600'} transition-colors`}

                    title="Eliminar entrenamiento de este día"

                  >

                    <Trash2 className="w-4 h-4" />

                  </button>

                )}

                <input 

                  type="date" 

                  value={logDate} 

                  max={formatDate(getTodayBogota())}

                  onChange={(e) => {

                    const selectedDate = e.target.value

                    const today = formatDate(getTodayBogota())

                    if (selectedDate > today) {

                      setLogDate(today) // Resetear a hoy si intenta seleccionar futuro

                      return

                    }

                    setLogDate(selectedDate)

                  }}

                  className={`${inputBg} ${textMain} p-2 rounded border ${inputBorder} text-sm disabled:opacity-50`}

                  disabled={!userId}

                />

              </div>

            </div>



            {/* Selector de Split */}

            <div className="mb-6">

              <div className="flex justify-between items-center mb-2">

                <label className={`block text-sm ${textSecondary}`}>Grupo Muscular</label>

                <button

                  onClick={() => {

                    if (!userId) {

                      setShowAuthModal(true)

                      return

                    }

                    setShowSplitEditor(!showSplitEditor)

                    if (!showSplitEditor) {

                      setEditingSplit(null)

                    }

                  }}

                  className={`text-xs ${isDarkMode ? 'text-orange-400 hover:text-orange-300' : 'text-orange-600 hover:text-orange-500'} flex items-center gap-1`}

                  disabled={!userId}

                >

                  <Edit2 className="w-3 h-3" />

                  {showSplitEditor ? 'Cerrar Editor' : 'Editar Splits'}

                </button>

              </div>

              

              {!showSplitEditor ? (

              <div className="flex flex-wrap gap-2">

                  {Object.keys(customSplits).map((split) => (

                  <button

                    key={split}

                    onClick={() => userId ? setSelectedSplit(split) : setShowAuthModal(true)}

                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${

                      selectedSplit === split 

                        ? `bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30` 

                        : `${bgCardHover} ${textSecondary} hover:border-orange-500/30`

                    } ${!userId ? 'opacity-50 cursor-not-allowed' : ''}`}

                    disabled={!userId}

                  >

                    {split}

                  </button>

                ))}

              </div>

              ) : (

                <div className={`space-y-4 ${bgCardHover} p-4 rounded-lg border ${borderSecondary}`}>

                  {Object.keys(customSplits).map((split) => (

                    <div key={split} className="space-y-2">

                      <div className="flex items-center gap-2">

                        {editingSplit === split ? (

                          <>

                            <input

                              type="text"

                              value={editingSplitName}

                              onChange={(e) => setEditingSplitName(e.target.value)}

                              className={`flex-1 ${inputBg} ${textMain} px-3 py-1.5 rounded border ${inputBorder} focus:outline-none focus:border-blue-500`}

                              autoFocus

                            />

                            <button

                              onClick={() => {

                                updateSplitName(split, editingSplitName)

                              }}

                              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded"

                            >

                              <Check className="w-4 h-4" />

                            </button>

                            <button

                              onClick={() => {

                                setEditingSplit(null)

                                setEditingSplitName('')

                              }}

                              className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded"

                            >

                              <X className="w-4 h-4" />

                            </button>

                          </>

                        ) : (

                          <>

                            <span className={`flex-1 font-semibold ${textMain}`}>{split}</span>

                            <button

                              onClick={() => {

                                setEditingSplit(split)

                                setEditingSplitName(split)

                              }}

                              className={`p-1.5 ${isDarkMode ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-700'}`}

                              title="Editar nombre"

                            >

                              <Edit2 className="w-4 h-4" />

                            </button>

                            {Object.keys(customSplits).length > 1 && (

                              <button

                                onClick={() => {

                                  setSplitToDelete(split)

                                  setDeleteModalType('split')

                                  setShowDeleteModal(true)

                                }}

                                className={`p-1.5 ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'}`}

                                title="Eliminar split"

                              >

                                <Trash2 className="w-4 h-4" />

                              </button>

                            )}

                          </>

                        )}

                      </div>

                      <div className="ml-4 space-y-3">

                        <div>

                          <label className={`block text-xs ${textSecondary} mb-2`}>Músculos del Split:</label>

                          <div className="flex flex-wrap gap-2">

                            {AVAILABLE_MUSCLES.map((muscle) => {

                              const isSelected = (splitMuscles[split] || []).includes(muscle)

                              return (

                                <button

                                  key={muscle}

                                  onClick={() => toggleMuscleInSplit(split, muscle)}

                                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${

                                    isSelected

                                      ? isDarkMode

                                        ? 'bg-emerald-600 text-white'

                                        : 'bg-emerald-600 text-white'

                                      : `${bgCard} ${textMain} border ${borderSecondary} hover:${bgCardHover}`

                                  }`}

                                >

                                  {muscle}

                                </button>

                              )

                            })}

                          </div>

                        </div>

                        <div>

                          <label className={`block text-xs ${textSecondary} mb-2`}>Ejercicios:</label>

                          <div className="flex flex-wrap gap-2">

                            {customSplits[split]?.map((ex) => (

                              <div key={ex} className={`flex items-center gap-1 ${bgCard} px-2 py-1 rounded-full text-xs`}>

                                <span className={textMain}>{ex}</span>

                                <button

                                  onClick={() => removeExerciseFromSplit(split, ex)}

                                  className="text-red-400 hover:text-red-300"

                                >

                                  <X className="w-3 h-3" />

                                </button>

                              </div>

                            ))}

                            <input

                              type="text"

                              placeholder="Agregar ejercicio..."

                              onKeyPress={(e) => {

                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {

                                  addExerciseToSplit(split, e.currentTarget.value.trim())

                                  e.currentTarget.value = ''

                                }

                              }}

                              className={`${inputBg} ${textMain} px-2 py-1 rounded text-xs border ${inputBorder} focus:outline-none focus:border-emerald-500 w-32`}

                            />

                          </div>

                        </div>

                      </div>

                    </div>

                  ))}

                  <div className="flex gap-2 mt-4">

                    <button

                      onClick={saveCustomSplits}

                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-lg transition-all"

                    >

                      Guardar Cambios

                    </button>

                    <button

                      onClick={async () => {

                        const newSplitName = `Split ${Object.keys(customSplits).length + 1}`

                        const newSplits = { ...customSplits, [newSplitName]: [] }

                        const newColors = { ...splitColors }

                        const newMuscles = { ...splitMuscles }

                        const splitIndex = Object.keys(newSplits).length - 1

                        newColors[newSplitName] = generateSplitColor(newSplitName, splitIndex)

                        newMuscles[newSplitName] = []

                        setCustomSplits(newSplits)

                        setSplitColors(newColors)

                        setSplitMuscles(newMuscles)

                        setSelectedSplit(newSplitName)

                        setEditingSplit(newSplitName)

                        setEditingSplitName(newSplitName)

                        

                        // Guardar inmediatamente

                        if (db && userId) {

                          try {

                            const splitsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'splits')

                            await setDoc(splitsRef, newSplits, { merge: true })

                            const colorsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'splitColors')

                            await setDoc(colorsRef, newColors, { merge: true })

                            const musclesRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'splitMuscles')

                            await setDoc(musclesRef, newMuscles, { merge: true })

                          } catch (error) {

                            console.error('Error saving new split', error)

                          }

                        }

                      }}

                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center gap-2"

                    >

                      <Plus className="w-4 h-4" />

                      Nuevo Split

                    </button>

                  </div>

                </div>

              )}

            </div>



            {/* Lista de Ejercicios Agregados - último agregado arriba */}

            <div className="space-y-6">

              {currentExercises.map((exercise, exIndex) => {

                const stats = exerciseStatsByName[exercise.name]

                return (

                <div key={exercise.id} className={`${bgCard} border ${borderMain} p-5 rounded-2xl shadow-lg backdrop-blur-sm ${isDarkMode ? 'bg-slate-800/80' : 'bg-white/90'}`}>

                  <div className="flex justify-between items-start mb-3">

                    <div className="flex-1 min-w-0">

                      <input

                        type="text"

                        value={exercise.name}

                        onChange={(e) => {

                          if (!userId) {

                            setShowAuthModal(true)

                            return

                          }

                          const newEx = [...currentExercises]

                          newEx[exIndex].name = e.target.value

                          setCurrentExercises(newEx)

                        }}

                        className={`${inputBg} text-lg font-semibold ${textMain} focus:outline-none w-full disabled:opacity-50 rounded-lg px-3 py-2`}

                        disabled={!userId}

                      />

                      {stats && (

                        <p className={`text-xs mt-1.5 ${textMuted}`}>

                          Promedio: <span className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}>{stats.avg} kg</span>

                          {' · '}

                          Máx: <span className={isDarkMode ? 'text-amber-400' : 'text-amber-600'}>{stats.max} kg</span>

                        </p>

                      )}

                    </div>

                    <button

                      onClick={() => {

                        if (!userId) {

                          setShowAuthModal(true)

                          return

                        }

                        const newEx = [...currentExercises]

                        newEx.splice(exIndex, 1)

                        setCurrentExercises(newEx)

                      }}

                      className="text-red-500 hover:text-red-400 p-1 disabled:opacity-50"

                      disabled={!userId}

                    >

                      <Trash2 className="w-4 h-4" />

                    </button>

                  </div>



                  <div className="space-y-3">

                    <div className={`grid grid-cols-6 gap-3 text-xs ${textMuted} uppercase tracking-wider text-center`}>

                      <div className="col-span-1">Set</div>

                      <div className="col-span-2">Kg</div>

                      <div className="col-span-2">Reps</div>

                      <div className="col-span-1"></div>

                    </div>

                    {exercise.sets.map((set, setIndex) => (

                      <div key={setIndex} className="grid grid-cols-6 gap-3 items-center">

                        <div className={`text-center ${textMuted} font-mono text-sm`}>{setIndex + 1}</div>

                        <div className="col-span-2">

                          <input

                            type="number"

                            placeholder="0"

                            value={set.weight}

                            onChange={(e) => updateSet(exIndex, setIndex, 'weight', e.target.value)}

                            className={`w-full ${inputBg} ${isDarkMode ? '' : 'bg-white'} border ${inputBorder} rounded-xl p-3 text-center text-base font-medium ${textMain} focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50`}

                            disabled={!userId}

                          />

                        </div>

                        <div className="col-span-2">

                          <input

                            type="number"

                            placeholder="0"

                            value={set.reps}

                            onChange={(e) => updateSet(exIndex, setIndex, 'reps', e.target.value)}

                            className={`w-full ${inputBg} ${isDarkMode ? '' : 'bg-white'} border ${inputBorder} rounded-xl p-3 text-center text-base font-medium ${textMain} focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50`}

                            disabled={!userId}

                          />

                        </div>

                        <div className="text-center">

                          <button

                            onClick={() => removeSet(exIndex, setIndex)}

                            className={`p-2 rounded-lg ${textMuted} hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors`}

                            disabled={!userId}

                          >

                            ✕

                          </button>

                        </div>

                      </div>

                    ))}

                    <button

                      onClick={() => addSet(exIndex)}

                      className={`w-full py-2 mt-2 text-xs font-bold ${textSecondary} hover:${textMain} ${bgCardHover} hover:${bgCard} rounded-xl border border-dashed ${borderSecondary} hover:${borderMain} transition-all disabled:opacity-50`}

                      disabled={!userId}

                    >

                      AGREGAR SERIE

                    </button>

                  </div>

                </div>

              );

              })}

            </div>



            {/* Agregar nuevo ejercicio */}

            <div className={`mt-6 p-4 ${bgCardHover} rounded-xl border border-dashed ${borderSecondary} ${!userId ? 'opacity-50 pointer-events-none' : ''}`}>

              <p className={`text-sm ${textSecondary} mb-3`}>Ejercicios Sugeridos para {selectedSplit}</p>

              <div className="space-y-3">

                {customSplits[selectedSplit] && customSplits[selectedSplit].length > 0 && (

                  <div>

                    <p className={`text-xs ${textMuted} mb-2`}>Del Split:</p>

                    <div className="flex flex-wrap gap-2">

                      {customSplits[selectedSplit].map((ex) => {

                        const st = exerciseStatsByName[ex]

                        return (

                        <button

                          key={ex}

                          onClick={() => handleAddExercise(ex)}

                          title={st ? `Promedio: ${st.avg} kg · Máx: ${st.max} kg` : undefined}

                          className={`text-xs ${bgCard} hover:${bgCardHover} ${textMain} px-3 py-2 rounded-xl transition-colors disabled:opacity-50 flex flex-col items-center gap-0.5`}

                          disabled={!userId}

                        >

                          <span>{ex}</span>

                          {st && <span className={`text-[10px] ${textMuted}`}>~{st.avg} kg · máx {st.max}</span>}

                        </button>

                      );})}

                    </div>

                  </div>

                )}

                {getMostUsedExercises.length > 0 && (

                  <div>

                    <p className={`text-xs ${textMuted} mb-2`}>Más Usados:</p>

                    <div className="flex flex-wrap gap-2">

                      {getMostUsedExercises.map((ex) => {

                        const st = exerciseStatsByName[ex]

                        return (

                        <button

                          key={ex}

                          onClick={() => handleAddExercise(ex)}

                          title={st ? `Promedio: ${st.avg} kg · Máx: ${st.max} kg` : undefined}

                          className={`text-xs ${isDarkMode ? 'bg-emerald-900/50 hover:bg-emerald-900/70' : 'bg-emerald-100 hover:bg-emerald-200'} ${isDarkMode ? 'text-emerald-200' : 'text-emerald-800'} px-3 py-2 rounded-xl transition-colors disabled:opacity-50 flex flex-col items-center gap-0.5`}

                          disabled={!userId}

                        >

                          <span>{ex}</span>

                          {st && <span className={`text-[10px] opacity-80`}>~{st.avg} kg · máx {st.max}</span>}

                        </button>

                      );})}

                    </div>

                  </div>

                )}

                <button

                  onClick={() => handleAddExercise('Nuevo Ejercicio')}

                  className={`text-xs ${bgCard} border ${borderSecondary} hover:${borderMain} ${textSecondary} px-3 py-1.5 rounded-full transition-colors disabled:opacity-50`}

                  disabled={!userId}

                >

                  + Personalizado

                </button>

              </div>

            </div>



            <button

              onClick={saveWorkout}

              className={`w-full mt-8 ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 sticky bottom-24 md:static disabled:opacity-50`}

              disabled={!userId}

            >

              <Save className="w-5 h-5" />

              GUARDAR EN LA NUBE

            </button>

            {!userId && (

              <p className={`text-center text-sm ${isDarkMode ? 'text-yellow-500' : 'text-yellow-600'} mt-2`}>

                Debes iniciar sesión con Google para guardar tu progreso.

              </p>

            )}

          </div>

        )}



        {/* Stats - Tablero Completo */}

        {view === 'stats' && (

          <div className="space-y-6 pb-10">

            {!userId && (

              <div className={`${isDarkMode ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-300'} p-3 rounded-lg mb-6 border flex items-center justify-center gap-2 animate-in slide-in-from-top duration-500`}>

                <BarChart2 className="w-5 h-5" />

                <p className="text-sm font-medium">Inicia sesión para ver tu historial y estadísticas.</p>

              </div>

            )}



            {/* Tablero de Estadísticas - Todo visible */}

            <div className="space-y-6 animate-in fade-in duration-300">

              {/* Fila 1: Gráficos principales */}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Progreso por Ejercicio */}

                <div className={`${bgCard} p-6 rounded-xl border ${borderMain} hover:border-emerald-500 transition-all`}>

                <h2 className={`text-xl font-bold ${textMain} mb-4 flex items-center gap-2`}>

                  <TrendingUp className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} />

                    Progreso de Carga

                </h2>

                  <div className="mb-4">

                  <select

                    value={statExercise}

                    onChange={(e) => setStatExercise(e.target.value)}

                      className={`w-full ${inputBg} ${textMain} p-2 rounded-lg border ${inputBorder} focus:outline-none focus:border-cyan-500 disabled:opacity-50 text-sm`}

                    disabled={!userId}

                  >

                      {exercisesWithData.length === 0 ? (

                        <option value="">No hay ejercicios con datos</option>

                      ) : (

                        exercisesWithData.map((ex) => (

                      <option key={ex} value={ex}>{ex}</option>

                        ))

                      )}

                  </select>

                </div>

                  <div className="h-48 w-full">

                  {exerciseChartData.length === 0 ? (

                    <div className={`h-full flex items-center justify-center ${textMuted} flex-col`}>

                        <BarChart2 className="w-8 h-8 mb-2 opacity-50" />

                        <p className="text-xs">{userId ? 'Sin datos' : 'Inicia sesión'}</p>

                    </div>

                  ) : (

                    <ResponsiveContainer width="100%" height="100%">

                      <LineChart data={exerciseChartData}>

                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#cbd5e1"} />

                          <XAxis dataKey="date" stroke={isDarkMode ? "#94a3b8" : "#64748b"} fontSize={10} tickFormatter={(str) => str.slice(5)} />

                          <YAxis stroke={isDarkMode ? "#94a3b8" : "#64748b"} fontSize={10} unit="kg" />

                        <Tooltip 

                          contentStyle={{ 

                            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', 

                            borderColor: isDarkMode ? '#1e293b' : '#e2e8f0', 

                            color: isDarkMode ? '#f1f5f9' : '#0f172a'

                          }}

                            formatter={(value: number) => [`${value} kg`, 'Peso']}

                          />

                          <Line type="monotone" dataKey="weight" stroke="#34d399" strokeWidth={2} dot={{ fill: '#34d399', r: 3 }} />

                        </LineChart>

                      </ResponsiveContainer>

                    )}

                  </div>

                </div>



                {/* Volumen por Split - Combinado */}

                <div className={`${bgCard} p-6 rounded-xl border ${borderMain} hover:border-indigo-500 transition-all`}>

                  <h2 className={`text-xl font-bold ${textMain} mb-4 flex items-center gap-2`}>

                    <Activity className={isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} />

                    Volumen por Split (Combinado)

                  </h2>

                  <div className="mb-4">

                    <div className="flex flex-wrap gap-2">

                      {Object.keys(customSplits).map((split, index) => {

                        const splitColor = generateSplitColor(split, index)

                        const colorMap: Record<string, string> = {

                          blue: '#3b82f6',

                          purple: '#9333ea',

                          red: '#ef4444',

                          green: '#10b981',

                          orange: '#f97316',

                          cyan: '#06b6d4',

                          pink: '#ec4899',

                          indigo: '#6366f1',

                          amber: '#f59e0b',

                          teal: '#14b8a6'

                        }

                        const hexColor = colorMap[splitColor] || colorMap.blue

                        return (

                          <div key={split} className="flex items-center gap-1">

                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hexColor }}></div>

                            <span className={`text-xs ${textSecondary}`}>{split}</span>

                          </div>

                        )

                      })}

                    </div>

                  </div>

                  <div className="h-48 w-full">

                    {!userId || Object.values(combinedSplitChartData).every(arr => arr.length === 0) ? (

                      <div className="h-full flex items-center justify-center text-slate-500 flex-col">

                        <Layers className="w-8 h-8 mb-2 opacity-50" />

                        <p className="text-xs">{userId ? 'Sin datos' : 'Inicia sesión'}</p>

                      </div>

                    ) : (

                      <ResponsiveContainer width="100%" height="100%">

                        <LineChart>

                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />

                          <XAxis 

                            dataKey="date" 

                            stroke="#94a3b8" 

                            fontSize={10} 

                            tickFormatter={(str) => str.slice(5)}

                            type="category"

                            allowDuplicatedCategory={false}

                          />

                          <YAxis stroke="#94a3b8" fontSize={10} />

                          <Tooltip 

                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }}

                            formatter={(value: number) => [`${value.toLocaleString()} kg`, 'Volumen']}

                          labelFormatter={(label) => `Fecha: ${label}`}

                        />

                          {Object.keys(customSplits).map((split, index) => {

                            const splitColor = generateSplitColor(split, index)

                            const colorMap: Record<string, string> = {

                              blue: '#3b82f6',

                              purple: '#9333ea',

                              red: '#ef4444',

                              green: '#10b981',

                              orange: '#f97316',

                              cyan: '#06b6d4',

                              pink: '#ec4899',

                              indigo: '#6366f1',

                              amber: '#f59e0b',

                              teal: '#14b8a6'

                            }

                            const hexColor = colorMap[splitColor] || colorMap.blue

                            const data = combinedSplitChartData[split] || []

                            if (data.length === 0) return null

                            return (

                              <Line 

                                key={split}

                                type="monotone" 

                                data={data}

                                dataKey="volume"

                                stroke={hexColor} 

                                strokeWidth={2.5}

                                dot={{ fill: hexColor, r: 4 }}

                                name={split}

                                connectNulls={false}

                              />

                            )

                          })}

                      </LineChart>

                    </ResponsiveContainer>

                  )}

                </div>

                </div>

              </div>



              {/* Volumen semanal (barras) */}

              {userId && (

                <div className={`${bgCard} p-6 rounded-xl border ${borderMain} hover:border-emerald-500 transition-all`}>

                  <h2 className={`text-xl font-bold ${textMain} mb-4 flex items-center gap-2`}>

                    <Activity className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} />

                    Volumen semanal (últimas 8 semanas)

                  </h2>

                  <div className="h-48 w-full">

                    {weeklyVolumeData.every(d => d.volume === 0) ? (

                      <div className={`h-full flex items-center justify-center ${textMuted} flex-col`}>

                        <BarChart2 className="w-8 h-8 mb-2 opacity-50" />

                        <p className="text-xs">Sin datos aún</p>

                      </div>

                    ) : (

                      <ResponsiveContainer width="100%" height="100%">

                        <BarChart data={weeklyVolumeData}>

                          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e2e8f0'} />

                          <XAxis dataKey="week" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={10} />

                          <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={10} />

                          <Tooltip

                            contentStyle={{

                              backgroundColor: isDarkMode ? '#0f172a' : '#fff',

                              borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',

                              color: isDarkMode ? '#f1f5f9' : '#0f172a'

                            }}

                            formatter={(value: number) => [`${value.toLocaleString()} kg`, 'Volumen']}

                          />

                          <Bar dataKey="volume" fill={isDarkMode ? '#34d399' : '#059669'} radius={[4, 4, 0, 0]} />

                        </BarChart>

                      </ResponsiveContainer>

                    )}

                  </div>

                </div>

              )}



              {/* Fila 2: Récords y Volumen */}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Récords Personales */}

                <div className={`${bgCard} p-6 rounded-xl border ${borderMain} hover:border-yellow-500 transition-all`}>

                  <h2 className={`text-xl font-bold ${textMain} mb-4 flex items-center gap-2`}>

                    <Award className="text-yellow-400" />

                    Récords Personales

                  </h2>

                  <div className="space-y-3 max-h-80 overflow-y-auto">

                    {recordsStats.personalRecords.length === 0 ? (

                      <div className={`text-center py-8 ${textMuted}`}>

                        <Award className="w-10 h-10 mx-auto mb-2 opacity-50" />

                        <p className="text-sm">{userId ? 'Sin récords' : 'Inicia sesión'}</p>

              </div>

            ) : (

                      recordsStats.personalRecords.slice(0, 6).map((record) => (

                        <div 

                          key={record.exercise}

                          className={`${bgCardHover} p-3 rounded-lg border ${borderSecondary} hover:border-yellow-500 transition-all`}

                        >

                          <div className="flex items-center gap-2 mb-2">

                            <Trophy className="w-4 h-4 text-yellow-400" />

                            <h3 className={`font-bold ${textMain} text-sm`}>{record.exercise}</h3>

                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs">

                            <div>

                              <div className={textSecondary}>Peso</div>

                              <div className="font-bold text-yellow-400">{record.maxWeight.weight}kg</div>

                            </div>

                            <div>

                              <div className={textSecondary}>Volumen</div>

                              <div className={`font-semibold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>{Math.round(record.maxVolume.volume / 1000)}k</div>

                            </div>

                            <div>

                              <div className={textSecondary}>Reps</div>

                              <div className={`font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{record.maxReps.reps}</div>

                            </div>

                          </div>

                        </div>

                      ))

                    )}

                  </div>

                </div>



                {/* Volumen por Ejercicio */}

                <div className={`${bgCard} p-6 rounded-xl border ${borderMain} hover:border-purple-500 transition-all`}>

                  <h2 className={`text-xl font-bold ${textMain} mb-4 flex items-center gap-2`}>

                    <Weight className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />

                    Volumen por Ejercicio

                  </h2>

                  <div className="space-y-2 max-h-80 overflow-y-auto">

                    {volumeByExerciseStats.length === 0 ? (

                      <div className={`text-center py-8 ${textMuted}`}>

                        <Weight className="w-10 h-10 mx-auto mb-2 opacity-50" />

                        <p className="text-sm">{userId ? 'Sin datos' : 'Inicia sesión'}</p>

                      </div>

                    ) : (

                      volumeByExerciseStats.slice(0, 8).map((stat) => (

                        <div 

                          key={stat.name} 

                          className={`${bgCardHover} p-3 rounded-lg border ${borderSecondary} hover:border-purple-500 transition-all`}

                        >

                          <div className="flex justify-between items-center mb-1">

                            <h3 className={`font-semibold ${textMain} text-sm`}>{stat.name}</h3>

                            <div className="text-right">

                              <div className={`text-sm font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>{stat.totalVolume.toLocaleString()} kg</div>

                            </div>

                          </div>

                          <div className={`flex justify-between items-center text-xs ${textSecondary} mb-1`}>

                            <span>{stat.sessions} sesiones</span>

                            <span>Prom: {stat.avgVolume.toLocaleString()} kg</span>

                          </div>

                          <div className={`h-1.5 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'} rounded-full overflow-hidden`}>

                            <div 

                              className={`h-full ${isDarkMode ? 'bg-purple-500' : 'bg-purple-600'} transition-all`}

                              style={{ width: `${(stat.totalVolume / volumeByExerciseStats[0].totalVolume) * 100}%` }}

                            />

                          </div>

                        </div>

                      ))

                    )}

                  </div>

                </div>

              </div>



              {/* Fila 3: Rendimiento Mejorado */}

              {(performanceStats.improvingExercises.length > 0 || performanceStats.decliningExercises.length > 0 || performanceStats.newExercises.length > 0 || (performanceStats.exerciseTrends && performanceStats.exerciseTrends.length > 0)) && (

                <div className={`${bgCard} p-6 rounded-xl border ${borderMain}`}>

                  <h2 className={`text-xl font-bold ${textMain} mb-4 flex items-center gap-2`}>

                    <Gauge className="text-orange-400" />

                    Análisis de Rendimiento (Últimos 30 días vs Anteriores 30 días)

                  </h2>

                  

                  {/* Tendencias de Ejercicios */}

                  {performanceStats.exerciseTrends && performanceStats.exerciseTrends.length > 0 && (

                    <div className="mb-6">

                      <h3 className={`text-sm font-semibold ${textSecondary} mb-3`}>Tendencias por Ejercicio</h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">

                        {performanceStats.exerciseTrends.slice(0, 9).map((trend) => (

                          <div key={trend.name} className={`${bgCardHover} p-3 rounded-lg border ${borderSecondary}`}>

                            <div className={`font-semibold ${textMain} text-sm mb-2`}>{trend.name}</div>

                            <div className="space-y-1 text-xs">

                              <div className="flex justify-between">

                                <span className={textSecondary}>Peso:</span>

                                <span className={`font-bold ${trend.weightChange >= 0 ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : 'text-red-400'}`}>

                                  {trend.weightChange >= 0 ? '+' : ''}{trend.weightChange}%

                                </span>

                              </div>

                              <div className="flex justify-between">

                                <span className={textSecondary}>Volumen:</span>

                                <span className={`font-bold ${trend.volumeChange >= 0 ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : 'text-red-400'}`}>

                                  {trend.volumeChange >= 0 ? '+' : ''}{trend.volumeChange}%

                                </span>

                              </div>

                              <div className="flex justify-between">

                                <span className={textSecondary}>Sesiones:</span>

                                <span className={`font-bold ${trend.sessionsChange >= 0 ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-600') : 'text-red-400'}`}>

                                  {trend.sessionsChange >= 0 ? '+' : ''}{trend.sessionsChange}%

                                </span>

                              </div>

                            </div>

                          </div>

                        ))}

                      </div>

                    </div>

                  )}



                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    {/* Mejoras */}

                    {performanceStats.improvingExercises.length > 0 && (

                      <div>

                        <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} mb-2 flex items-center gap-1`}>

                          <ArrowUpRight className="w-4 h-4" />

                          Mejorando ({performanceStats.improvingExercises.length})

                        </h3>

                        <div className="space-y-2">

                          {performanceStats.improvingExercises.slice(0, 5).map((ex) => (

                            <div key={ex.name} className={`${isDarkMode ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-emerald-100 border-emerald-300'} border p-2 rounded text-xs`}>

                              <div className={`font-semibold ${textMain}`}>{ex.name}</div>

                              <div className={`${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} font-bold`}>

                                +{ex.improvement}% {ex.type === 'weight' ? 'en peso' : 'en volumen'}

                              </div>

                              <div className={`text-xs ${textMuted}`}>

                                {ex.type === 'weight' ? `${ex.oldMax}kg → ${ex.newMax}kg` : `${Math.round(ex.oldMax)}kg → ${Math.round(ex.newMax)}kg`}

                              </div>

                            </div>

                          ))}

                        </div>

                      </div>

                    )}



                    {/* Declinando */}

                    {performanceStats.decliningExercises.length > 0 && (

                      <div>

                        <h3 className={`text-sm font-semibold text-red-400 mb-2 flex items-center gap-1`}>

                          <ArrowDownRight className="w-4 h-4" />

                          A Revisar ({performanceStats.decliningExercises.length})

                        </h3>

                        <div className="space-y-2">

                          {performanceStats.decliningExercises.slice(0, 5).map((ex) => (

                            <div key={ex.name} className={`${isDarkMode ? 'bg-red-900/20 border-red-700/50' : 'bg-red-100 border-red-300'} border p-2 rounded text-xs`}>

                              <div className={`font-semibold ${textMain}`}>{ex.name}</div>

                              <div className="text-red-400 font-bold">

                                -{ex.decline}% {ex.type === 'weight' ? 'en peso' : 'en volumen'}

                              </div>

                              <div className={`text-xs ${textMuted}`}>

                                {ex.type === 'weight' ? `${ex.oldMax}kg → ${ex.newMax}kg` : `${Math.round(ex.oldMax)}kg → ${Math.round(ex.newMax)}kg`}

                              </div>

                            </div>

                          ))}

                        </div>

                      </div>

                    )}



                    {/* Nuevos */}

                    {performanceStats.newExercises.length > 0 && (

                      <div>

                        <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} mb-2 flex items-center gap-1`}>

                          <Plus className="w-4 h-4" />

                          Nuevos ({performanceStats.newExercises.length})

                        </h3>

                        <div className="flex flex-wrap gap-1">

                          {performanceStats.newExercises.slice(0, 6).map((ex) => (

                            <div key={ex} className={`${isDarkMode ? 'bg-blue-900/20 border-blue-700/50 text-blue-300' : 'bg-blue-100 border-blue-300 text-blue-700'} border px-2 py-1 rounded text-xs`}>

                              {ex}

                            </div>

                          ))}

                        </div>

                      </div>

                    )}

                  </div>

                </div>

              )}

            </div>

          </div>

        )}



        {/* Profile */}

        {view === 'profile' && (

          <div className="space-y-6 pb-10 animate-in fade-in duration-300">

            {!userId && (

              <div className="bg-red-900/50 text-red-300 p-3 rounded-lg mb-6 border border-red-700 flex items-center justify-center gap-2">

                <UserCircle className="w-5 h-5" />

                <p className="text-sm font-medium">Inicia sesión para ver y editar tu perfil.</p>

              </div>

            )}



            {/* Perfil Personal */}

            <div className={`${bgCard} p-6 rounded-xl border ${borderMain}`}>

              <h2 className={`text-xl font-bold ${textMain} mb-4 flex items-center gap-2`}>

                <UserCircle className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />

                Datos Personales

              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div>

                  <label className={`block text-sm ${textSecondary} mb-2`}>Edad</label>

                  <input

                    type="number"

                    value={userProfile?.age || ''}

                    onChange={(e) => setUserProfile({ ...userProfile || { age: 0, height: 0, weight: 0 }, age: parseInt(e.target.value) || 0 })}

                    className={`w-full ${inputBg} ${textMain} p-3 rounded-lg border ${inputBorder} focus:outline-none focus:border-blue-500 disabled:opacity-50`}

                    disabled={!userId}

                    placeholder="Años"

                  />

                </div>

                <div>

                  <label className={`block text-sm ${textSecondary} mb-2`}>Altura (cm)</label>

                  <input

                    type="number"

                    value={userProfile?.height || ''}

                    onChange={(e) => setUserProfile({ ...userProfile || { age: 0, height: 0, weight: 0 }, height: parseFloat(e.target.value) || 0 })}

                    className={`w-full ${inputBg} ${textMain} p-3 rounded-lg border ${inputBorder} focus:outline-none focus:border-blue-500 disabled:opacity-50`}

                    disabled={!userId}

                    placeholder="cm"

                  />

                </div>

                <div>

                  <label className={`block text-sm ${textSecondary} mb-2`}>Peso Actual (kg)</label>

                  <input

                    type="number"

                    step="0.1"

                    value={userProfile?.weight || ''}

                    onChange={(e) => setUserProfile({ ...userProfile || { age: 0, height: 0, weight: 0 }, weight: parseFloat(e.target.value) || 0 })}

                    className={`w-full ${inputBg} ${textMain} p-3 rounded-lg border ${inputBorder} focus:outline-none focus:border-blue-500 disabled:opacity-50`}

                    disabled={!userId}

                    placeholder="kg"

                  />

                </div>

              </div>

              <div className="mt-4">

                <label className={`block text-sm ${textSecondary} mb-2`}>Días de Descanso Permitidos por Semana</label>

                <input

                  type="number"

                  min="0"

                  max="6"

                  value={userProfile?.restDaysPerWeek || 0}

                  onChange={(e) => setUserProfile({ ...userProfile || { age: 0, height: 0, weight: 0, restDaysPerWeek: 0 }, restDaysPerWeek: parseInt(e.target.value) || 0 })}

                  className={`w-full ${inputBg} ${textMain} p-3 rounded-lg border ${inputBorder} focus:outline-none focus:border-blue-500 disabled:opacity-50`}

                  disabled={!userId}

                  placeholder="0"

                />

                <p className={`text-xs ${textMuted} mt-1`}>Los días de descanso no romperán tu racha hasta alcanzar este límite semanal.</p>

              </div>

                      <button

                onClick={saveProfile}

                disabled={!userId}

                className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-all disabled:opacity-50"

              >

                Guardar Perfil

                      </button>



              {/* IMC */}

              {userProfile && userProfile.height > 0 && userProfile.weight > 0 && (

                <div className={`mt-6 p-4 ${bgCardHover} rounded-lg border ${borderSecondary}`}>

                  <div className="flex items-center justify-between">

                    <div>

                      <div className={`text-sm ${textSecondary}`}>Índice de Masa Corporal (IMC)</div>

                      <div className={`text-3xl font-bold ${textMain} mt-1`}>{calculateBMI()}</div>

                      {calculateBMI() && (

                        <div className={`text-sm font-semibold mt-1 ${getBMICategory(calculateBMI()!).color}`}>

                          {getBMICategory(calculateBMI()!).label}

                  </div>

                      )}

                </div>

                    <Heart className={`w-12 h-12 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} opacity-50`} />

                    </div>

                </div>

              )}

            </div>



            {/* Renombrar ejercicio en todo el historial */}

            {userId && allUniqueExerciseNames.length > 0 && (

              <div className={`${bgCard} p-6 rounded-xl border ${borderMain}`}>

                <h2 className={`text-xl font-bold ${textMain} mb-4 flex items-center gap-2`}>

                  <Edit2 className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} />

                  Renombrar ejercicio en todo el historial

                </h2>

                <p className={`text-sm ${textSecondary} mb-4`}>

                  Si escribiste mal el nombre de un ejercicio desde el principio, puedes corregirlo en todos los entrenamientos de una vez.

                </p>

                <button

                  onClick={() => { setRenameOldName(''); setRenameNewName(''); setShowRenameModal(true); }}

                  className={`py-2.5 px-4 rounded-xl font-medium ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}

                >

                  Renombrar ejercicio

                </button>

              </div>

            )}



            {/* Registrar Medidas */}

            <div className={`${bgCard} p-6 rounded-xl border ${borderMain}`}>

              <h2 className={`text-xl font-bold ${textMain} mb-4 flex items-center gap-2`}>

                <Ruler className="text-purple-400" />

                Registrar Medidas Corporales

              </h2>

              <div className="mb-4">

                <label className={`block text-sm ${textSecondary} mb-2`}>Fecha</label>

                <input

                  type="date"

                  value={measurementDate}

                  onChange={(e) => setMeasurementDate(e.target.value)}

                  className={`w-full ${inputBg} ${textMain} p-3 rounded-lg border ${inputBorder} focus:outline-none focus:border-purple-500 disabled:opacity-50`}

                  disabled={!userId}

                />

              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

                <div>

                  <label className={`block text-sm ${textSecondary} mb-2`}>Peso (kg) *</label>

                  <input

                    type="number"

                    step="0.1"

                    value={newMeasurement.weight}

                    onChange={(e) => setNewMeasurement({ ...newMeasurement, weight: e.target.value })}

                    className={`w-full ${inputBg} ${textMain} p-3 rounded-lg border ${inputBorder} focus:outline-none focus:border-purple-500 disabled:opacity-50`}

                    disabled={!userId}

                    placeholder="kg"

                  />

                </div>

                <div>

                  <label className={`block text-sm ${textSecondary} mb-2`}>Pecho (cm)</label>

                  <input

                    type="number"

                    value={newMeasurement.chest}

                    onChange={(e) => setNewMeasurement({ ...newMeasurement, chest: e.target.value })}

                    className={`w-full ${inputBg} ${textMain} p-3 rounded-lg border ${inputBorder} focus:outline-none focus:border-purple-500 disabled:opacity-50`}

                    disabled={!userId}

                    placeholder="cm"

                  />

                </div>

                <div>

                  <label className={`block text-sm ${textSecondary} mb-2`}>Cintura (cm)</label>

                  <input

                    type="number"

                    value={newMeasurement.waist}

                    onChange={(e) => setNewMeasurement({ ...newMeasurement, waist: e.target.value })}

                    className={`w-full ${inputBg} ${textMain} p-3 rounded-lg border ${inputBorder} focus:outline-none focus:border-purple-500 disabled:opacity-50`}

                    disabled={!userId}

                    placeholder="cm"

                  />

                </div>

                <div>

                  <label className={`block text-sm ${textSecondary} mb-2`}>Cadera (cm)</label>

                  <input

                    type="number"

                    value={newMeasurement.hips}

                    onChange={(e) => setNewMeasurement({ ...newMeasurement, hips: e.target.value })}

                    className={`w-full ${inputBg} ${textMain} p-3 rounded-lg border ${inputBorder} focus:outline-none focus:border-purple-500 disabled:opacity-50`}

                    disabled={!userId}

                    placeholder="cm"

                  />

                </div>

                <div>

                  <label className={`block text-sm ${textSecondary} mb-2`}>Bíceps (cm)</label>

                  <input

                    type="number"

                    value={newMeasurement.biceps}

                    onChange={(e) => setNewMeasurement({ ...newMeasurement, biceps: e.target.value })}

                    className={`w-full ${inputBg} ${textMain} p-3 rounded-lg border ${inputBorder} focus:outline-none focus:border-purple-500 disabled:opacity-50`}

                    disabled={!userId}

                    placeholder="cm"

                  />

                </div>

                <div>

                  <label className={`block text-sm ${textSecondary} mb-2`}>Muslo (cm)</label>

                  <input

                    type="number"

                    value={newMeasurement.thighs}

                    onChange={(e) => setNewMeasurement({ ...newMeasurement, thighs: e.target.value })}

                    className={`w-full ${inputBg} ${textMain} p-3 rounded-lg border ${inputBorder} focus:outline-none focus:border-purple-500 disabled:opacity-50`}

                    disabled={!userId}

                    placeholder="cm"

                  />

                </div>

              </div>

              <button

                onClick={saveMeasurement}

                disabled={!userId}

                className="mt-4 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-lg transition-all disabled:opacity-50"

              >

                Guardar Medida

              </button>

            </div>



            {/* Gráfico de Progreso de Peso */}

            {bodyMeasurements.length > 0 && (

              <div className={`${bgCard} p-6 rounded-xl border ${borderMain}`}>

                <h2 className={`text-xl font-bold ${textMain} mb-4 flex items-center gap-2`}>

                  <Scale className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} />

                  Progreso de Peso

                </h2>

                <div className="h-64 w-full">

                    <ResponsiveContainer width="100%" height="100%">

                    <LineChart data={bodyMeasurements.map(m => ({ date: m.date, weight: m.weight }))}>

                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#cbd5e1"} />

                        <XAxis dataKey="date" stroke={isDarkMode ? "#94a3b8" : "#64748b"} fontSize={12} tickFormatter={(str) => str.slice(5)} />

                      <YAxis stroke={isDarkMode ? "#94a3b8" : "#64748b"} fontSize={12} unit="kg" />

                        <Tooltip 

                          contentStyle={{ 

                            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', 

                            borderColor: isDarkMode ? '#1e293b' : '#e2e8f0', 

                            color: isDarkMode ? '#f1f5f9' : '#0f172a'

                          }}

                        formatter={(value: number) => [`${value} kg`, 'Peso']}

                        />

                      <Line type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5 }} />

                    </LineChart>

                    </ResponsiveContainer>

                </div>

              </div>

            )}



            {/* Historial de Medidas */}

            {bodyMeasurements.length > 0 && (

              <div className={`${bgCard} p-6 rounded-xl border ${borderMain}`}>

                <h2 className={`text-xl font-bold ${textMain} mb-4 flex items-center gap-2`}>

                  <Activity className={isDarkMode ? 'text-orange-400' : 'text-orange-600'} />

                  Historial de Medidas

                </h2>

                <div className="space-y-3 max-h-96 overflow-y-auto">

                  {bodyMeasurements.slice().reverse().map((measurement) => (

                    <div key={measurement.id} className={`${bgCardHover} p-4 rounded-lg border ${borderSecondary}`}>

                      <div className="flex justify-between items-center mb-2">

                        <div className={`font-semibold ${textMain}`}>{measurement.date}</div>

                        <div className={`text-lg font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{measurement.weight} kg</div>

                </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">

                        {measurement.chest && (

                          <div>

                            <span className={textSecondary}>Pecho:</span>

                            <span className={`${textMain} ml-1`}>{measurement.chest} cm</span>

                          </div>

                        )}

                        {measurement.waist && (

                          <div>

                            <span className={textSecondary}>Cintura:</span>

                            <span className={`${textMain} ml-1`}>{measurement.waist} cm</span>

                          </div>

                        )}

                        {measurement.hips && (

                          <div>

                            <span className={textSecondary}>Cadera:</span>

                            <span className={`${textMain} ml-1`}>{measurement.hips} cm</span>

                          </div>

                        )}

                        {measurement.biceps && (

                          <div>

                            <span className={textSecondary}>Bíceps:</span>

                            <span className={`${textMain} ml-1`}>{measurement.biceps} cm</span>

                          </div>

                        )}

                        {measurement.thighs && (

                          <div>

                            <span className={textSecondary}>Muslo:</span>

                            <span className={`${textMain} ml-1`}>{measurement.thighs} cm</span>

                          </div>

                        )}

                      </div>

                    </div>

                  ))}

                </div>

              </div>

            )}



            {/* Botón Cerrar Sesión - Solo Móvil */}

            {user && (

              <div className="md:hidden">

                <button

                  onClick={handleSignOut}

                  className={`w-full ${isDarkMode ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400 border-red-700/50' : 'bg-red-100 hover:bg-red-200 text-red-600 border-red-300'} border p-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2`}

                >

                  <LogOut className="w-5 h-5" />

                  Cerrar Sesión

                </button>

              </div>

            )}

          </div>

        )}



      </main>



      {/* Nav móvil - Glassmorphism flotante */}

      <nav className={`fixed bottom-4 left-4 right-4 ${isDarkMode ? 'bg-zinc-900/80' : 'bg-white/80'} backdrop-blur-2xl border ${isDarkMode ? 'border-orange-500/15' : 'border-orange-200/50'} p-2 md:hidden z-20 rounded-2xl shadow-2xl ${isDarkMode ? 'shadow-orange-500/10' : 'shadow-orange-500/20'}`}>

        <div className="flex justify-around items-center">

          <button onClick={() => setView('dashboard')} className={`p-2.5 rounded-xl flex flex-col items-center gap-1 transition-all ${view === 'dashboard' ? (isDarkMode ? 'text-orange-400 bg-orange-500/20' : 'text-orange-600 bg-orange-100') : textSecondary}`}>

            <Activity size={20} />

            <span className="text-[10px] font-medium">Inicio</span>

          </button>

          <button onClick={() => setView('calendar')} className={`p-2.5 rounded-xl flex flex-col items-center gap-1 transition-all ${view === 'calendar' ? (isDarkMode ? 'text-orange-400 bg-orange-500/20' : 'text-orange-600 bg-orange-100') : textSecondary}`}>

            <Calendar size={20} />

            <span className="text-[10px] font-medium">Calendario</span>

          </button>

          <button onClick={() => setView('stats')} className={`p-2.5 rounded-xl flex flex-col items-center gap-1 transition-all ${view === 'stats' ? (isDarkMode ? 'text-orange-400 bg-orange-500/20' : 'text-orange-600 bg-orange-100') : textSecondary}`}>

            <BarChart2 size={20} />

            <span className="text-[10px] font-medium">Progreso</span>

          </button>

          <button onClick={() => setView('profile')} className={`p-2.5 rounded-xl flex flex-col items-center gap-1 transition-all ${view === 'profile' ? (isDarkMode ? 'text-orange-400 bg-orange-500/20' : 'text-orange-600 bg-orange-100') : textSecondary}`}>

            <UserCircle size={20} />

            <span className="text-[10px] font-medium">Perfil</span>

          </button>

        </div>

      </nav>



      {/* Nav desktop - Glassmorphism sidebar */}

      <nav className={`hidden md:flex fixed left-0 top-0 bottom-0 w-20 flex-col items-center py-8 gap-6 border-r ${isDarkMode ? 'border-orange-500/10' : 'border-orange-200/50'} ${isDarkMode ? 'bg-zinc-900/80 backdrop-blur-2xl' : 'bg-white/80 backdrop-blur-2xl'} ${showAuthModal ? 'pointer-events-none' : ''}`}>

        <button onClick={() => setView('dashboard')} className={`p-3 rounded-xl transition-all w-full flex justify-center ${view === 'dashboard' ? (isDarkMode ? 'bg-orange-500/20 text-orange-400 border-l-2 border-orange-400 -ml-px pl-px' : 'bg-orange-100 text-orange-600 border-l-2 border-orange-500 -ml-px pl-px') : `${textSecondary} border-l-2 border-transparent ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-orange-50'}`}`}>

          <Activity size={24} />

        </button>

        <button onClick={() => setView('calendar')} className={`p-3 rounded-xl transition-all w-full flex justify-center ${view === 'calendar' ? (isDarkMode ? 'bg-orange-500/20 text-orange-400 border-l-2 border-orange-400 -ml-px pl-px' : 'bg-orange-100 text-orange-600 border-l-2 border-orange-500 -ml-px pl-px') : `${textSecondary} border-l-2 border-transparent ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-orange-50'}`}`}>

          <Calendar size={24} />

        </button>

        <button

          onClick={() => {

            if (!userId) {

              setShowAuthModal(true)

              return

            }

            setView('log')

          }}

          className={`p-3 rounded-xl transition-all w-full flex justify-center ${view === 'log' ? (isDarkMode ? 'bg-orange-500/20 text-orange-400 border-l-2 border-orange-400 -ml-px pl-px' : 'bg-orange-100 text-orange-600 border-l-2 border-orange-500 -ml-px pl-px') : `${textSecondary} border-l-2 border-transparent ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-orange-50'}`}`}

        >

          <Plus size={24} />

        </button>

        <button onClick={() => setView('stats')} className={`p-3 rounded-xl transition-all w-full flex justify-center ${view === 'stats' ? (isDarkMode ? 'bg-orange-500/20 text-orange-400 border-l-2 border-orange-400 -ml-px pl-px' : 'bg-orange-100 text-orange-600 border-l-2 border-orange-500 -ml-px pl-px') : `${textSecondary} border-l-2 border-transparent ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-orange-50'}`}`}>

          <BarChart2 size={24} />

        </button>

        <button onClick={() => setView('profile')} className={`p-3 rounded-xl transition-all w-full flex justify-center ${view === 'profile' ? (isDarkMode ? 'bg-orange-500/20 text-orange-400 border-l-2 border-orange-400 -ml-px pl-px' : 'bg-orange-100 text-orange-600 border-l-2 border-orange-500 -ml-px pl-px') : `${textSecondary} border-l-2 border-transparent ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-orange-50'}`}`} title="Perfil">

          <UserCircle size={24} />

        </button>

        <div className="flex-1"></div>

        {user && (

          <button onClick={handleSignOut} className={`p-3 rounded-xl transition-all ${textSecondary} ${isDarkMode ? 'hover:bg-red-900/20 hover:text-red-400' : 'hover:bg-red-100 hover:text-red-600'}`} title="Cerrar Sesión">

            <LogOut size={24} />

          </button>

        )}

      </nav>



      {/* Botón Flotante - Registrar Entrenamiento */}

      {view !== 'log' && (

        <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-30 flex flex-col gap-3">

          {userId && (

            <button

              onClick={takeRestDay}

              className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white font-semibold py-3 px-5 rounded-2xl shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/40 hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 flex items-center gap-2"

              title="Tomar día de descanso"

            >

              <Coffee className="w-5 h-5" />

              <span className="md:hidden">Descanso</span>

              <span className="hidden md:inline">Descanso</span>

            </button>

          )}

          <button 

            onClick={() => {

              if (!userId) {

                setShowAuthModal(true)

                return

              }

              setLogDate(formatDate(getTodayBogota()))

              setView('log')

            }}

            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold py-4 px-6 rounded-2xl shadow-xl shadow-orange-500/35 hover:shadow-2xl hover:shadow-orange-500/45 hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 flex items-center gap-2"

            title="Registrar Entrenamiento"

          >

            <Plus className="w-6 h-6" />

            <span className="md:hidden">Agregar</span>

            <span className="hidden md:inline">Registrar Hoy</span>

          </button>

        </div>

      )}

    </div>

  )

}



export default App
