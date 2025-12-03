import { useState, useEffect, useMemo } from 'react'
import { Calendar, Plus, BarChart2, Save, Trash2, Dumbbell, ChevronLeft, ChevronRight, Activity, TrendingUp, Layers, Loader, Cloud, LogIn, User, LogOut } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithCustomToken, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence, signOut } from 'firebase/auth'
import { getFirestore, doc, setDoc, onSnapshot, collection, query } from 'firebase/firestore'

// Interfaces de tipos
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

// Utilitarios tipados
const getDaysInMonth = (year: number, month: number): number => new Date(year, month + 1, 0).getDate()
const getFirstDayOfMonth = (year: number, month: number): number => new Date(year, month, 1).getDay()
const formatDate = (date: Date): string => date.toISOString().split('T')[0]

const ARNOLD_SPLIT: Record<string, string[]> = {
  'Pecho y Espalda': ['Press Banca', 'Remo con Barra', 'Press Inclinado', 'Dominadas', 'Aperturas', 'Pull Over'],
  'Hombros y Brazos': ['Press Militar', 'Elevaciones Laterales', 'Curl con Barra', 'Press Francés', 'Curl Martillo', 'Extensiones Tríceps'],
  'Pierna': ['Sentadilla', 'Peso Muerto Rumano', 'Prensa', 'Extensiones de Cuádriceps', 'Curl Femoral', 'Pantorrillas']
}

const App = () => {
  // Estados tipados
  const [view, setView] = useState<'dashboard' | 'calendar' | 'log' | 'stats'>('dashboard')
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [logDate, setLogDate] = useState(formatDate(new Date()))
  const [selectedSplit, setSelectedSplit] = useState('Pecho y Espalda')
  const [currentExercises, setCurrentExercises] = useState<Exercise[]>([])
  const [db, setDb] = useState<any>(null)
  const [auth, setAuth] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [statExercise, setStatExercise] = useState('Press Banca')

  const initialAuthToken: string | null = typeof window !== 'undefined' && (window as any).initialAuthToken ? (window as any).initialAuthToken : null

  // Inicialización Firebase
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

  // Mostrar modal si no hay sesión
  useEffect(() => {
    if (isAuthReady && !userId) {
      setShowAuthModal(true)
    }
  }, [isAuthReady, userId])

  // Carga de workouts
  useEffect(() => {
    if (!isAuthReady || !db || !userId) {
      setWorkouts([])
      return
    }

    const workoutsCollectionRef = collection(db, 'artifacts', APP_ID, 'users', userId, 'workouts')
    const q = query(workoutsCollectionRef)
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedWorkouts: Workout[] = []
      snapshot.forEach((doc) => loadedWorkouts.push(doc.data() as Workout))
      setWorkouts(loadedWorkouts)
    }, (error) => {
      console.error('Error fetching workouts from Firestore', error)
    })

    return unsubscribe
  }, [isAuthReady, db, userId])

  // Cargar ejercicios existentes
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
      setView('dashboard')
    } catch (error) {
      console.error('Error al cerrar sesión', error)
    }
  }

  const handleAddExercise = (exerciseName: string) => {
    if (!userId) {
      setShowAuthModal(true)
      return
    }
    setCurrentExercises([...currentExercises, { id: Date.now(), name: exerciseName, sets: [{ weight: '', reps: '' }] }])
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
      else alert('Error: La base de datos no está lista. Intenta de nuevo.')
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
        .filter(ex => ex.sets.length > 0)
    }

    if (newWorkout.exercises.length === 0) {
      alert('Por favor, agrega al menos un set válido para guardar el entrenamiento.')
      return
    }

    try {
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'workouts', logDate)
      await setDoc(docRef, newWorkout)
      setView('calendar')
      setCurrentExercises([])
      console.log('Entrenamiento guardado con éxito en Firestore!')
    } catch (error) {
      console.error('Error saving workout to Firestore', error)
      alert('Error al guardar el entrenamiento. Verifica tu conexión.')
    }
  }

  // Datos para gráficos
  const chartData = useMemo((): { date: string; weight: number }[] => {
    if (!userId || workouts.length === 0) return []
    const dataPoints: { date: string; weight: number }[] = []
    workouts
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((workout) => {
        workout.exercises.forEach((ex) => {
          if (ex.name === statExercise) {
            const maxWeight = Math.max(...ex.sets.map(s => parseFloat(s.weight) || 0))
            if (maxWeight > 0) {
              dataPoints.push({ date: workout.date, weight: maxWeight })
            }
          }
        })
      })
    return dataPoints
  }, [workouts, statExercise, userId])

  const allExercisesList = useMemo(() => {
    const set = new Set(Object.values(ARNOLD_SPLIT).flat())
    if (userId) {
      workouts.forEach(w => w.exercises.forEach(e => set.add(e.name)))
    }
    return Array.from(set).sort()
  }, [workouts, userId])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="flex flex-col items-center p-8 bg-slate-900 rounded-xl shadow-2xl">
          <Loader className="w-10 h-10 text-emerald-400 animate-spin" />
          <p className="mt-4 text-lg font-semibold">Cargando aplicación...</p>
          <p className="text-sm text-slate-500 mt-1">Verificando sesión persistente...</p>
        </div>
      </div>
    )
  }

  const AuthModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 max-w-sm w-full shadow-2xl transform transition-all scale-100 animate-fade-in-up">
        <Dumbbell className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white text-center mb-2">Bienvenido a Arnold Tracker</h2>
        <p className="text-slate-400 text-center mb-6">
          Para guardar tu progreso de entrenamiento de forma persistente y no perder tus récords, por favor, inicia sesión.
        </p>
        <button onClick={signInWithGoogle} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-900/50">
          <svg className="w-5 h-5" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.61 20.08v3.42H24V20.08z"/>
            <path fill="#FF3D00" d="M6.39 20.08V23.5H24V20.08z"/>
            <path fill="#4CAF50" d="M6.39 30.22v3.42H24V30.22z"/>
            <path fill="#1976D2" d="M43.61 30.22V33.64H24V30.22z"/>
            <path fill="#2196F3" d="M24 6.39C14.7 6.39 6.39 14.7 6.39 24s8.31 17.61 17.61 17.61 17.61-8.31 17.61-17.61H24z"/>
            <path fill="#BBDEFB" d="M24 6.39c8.31 0 15.22 5.09 16.94 12.08H24z"/>
          </svg>
          Iniciar Sesión con Google
        </button>
        <p className="text-xs text-slate-500 text-center mt-4">Tus datos serán guardados en tu cuenta de Google.</p>
      </div>
    </div>
  )

  const renderCalendar = () => {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)
    const days: JSX.Element[] = []

    // Relleno días vacíos
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-10" />)
    }

    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDayString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const workoutOnDay = workouts.find(w => w.date === currentDayString)
      let bgClass = 'bg-slate-800 hover:bg-slate-700 text-slate-300'

      if (userId && workoutOnDay) {
        if (workoutOnDay.split.includes('Pierna')) {
          bgClass = 'bg-red-900/80 border border-red-500 text-white font-bold'
        } else if (workoutOnDay.split.includes('Pecho')) {
          bgClass = 'bg-blue-900/80 border border-blue-500 text-white font-bold'
        } else {
          bgClass = 'bg-green-900/80 border border-green-500 text-white font-bold'
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
            setLogDate(currentDayString)
            setView('log')
          }}
          className={`h-10 w-10 md:h-14 md:w-14 rounded-lg flex items-center justify-center text-sm transition-all ${bgClass}`}
        >
          {day}
        </button>
      )
    }

    return days
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20 md:pb-0">
      {showAuthModal && <AuthModal />}

      {/* Header */}
      <header className={`bg-slate-900 p-4 border-b border-slate-800 sticky top-0 z-10 shadow-lg ${showAuthModal ? 'pointer-events-none' : ''}`}>
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
            <Dumbbell className="text-blue-400" />
            Arnold Tracker
          </h1>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="text-xs text-slate-400 hidden sm:block">
                  Hola, {user.displayName?.split(' ')[0]}!
                </div>
                <button onClick={handleSignOut} className="text-slate-400 hover:text-red-400 p-2 rounded-full transition-colors hidden md:block" title="Cerrar Sesión">
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <div className="text-xs text-slate-500 hidden md:flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-emerald-400" />
                  Sincronizado
                </div>
                <button onClick={() => setShowAuthModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-1.5 px-3 rounded-lg text-sm flex items-center gap-1">
                  <LogIn className="w-4 h-4" />
                  Iniciar
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className={`max-w-4xl mx-auto p-4 ${showAuthModal ? 'pointer-events-none opacity-50' : ''}`}>
        {!userId && isAuthReady && (
          <div className="bg-yellow-900/50 text-yellow-300 p-3 rounded-lg mb-6 border border-yellow-700 flex items-center justify-center gap-2">
            <User className="w-5 h-5" />
            <p className="text-sm font-medium">Inicia sesión para guardar y ver tu progreso.</p>
          </div>
        )}

        {/* Dashboard */}
        {view === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-sm">Entrenos Totales</div>
                <div className="text-3xl font-bold text-white">{userId ? workouts.length : '-'}</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-sm">Último Entreno</div>
                <div className="text-lg font-bold text-emerald-400">
                  {userId && workouts.length > 0 
                    ? workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].split 
                    : 'Sin datos'
                  }
                </div>
              </div>
            </div>
            
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <h2 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Actividad Reciente
              </h2>
              <div className="space-y-3">
                {userId 
                  ? workouts
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 3)
                      .map((workout) => (
                        <div key={workout.id} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg">
                          <div>
                            <div className="font-medium text-white">{workout.split}</div>
                            <div className="text-xs text-slate-400">{workout.date}</div>
                          </div>
                          <div className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                            {workout.exercises.length} Ejercicios
                          </div>
                        </div>
                      ))
                  : !userId && workouts.length === 0 && (
                      <p className="text-slate-500 italic">No hay entrenamientos recientes.</p>
                    )
                }
              </div>
            </div>

            <button 
              onClick={() => {
                if (!userId) {
                  setShowAuthModal(true)
                  return
                }
                setLogDate(formatDate(new Date()))
                setView('log')
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-6 h-6" />
              Registrar Entrenamiento de Hoy
            </button>
          </div>
        )}

        {/* Calendar */}
        {view === 'calendar' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))} className="p-2 hover:bg-slate-800 rounded-full">
                <ChevronLeft />
              </button>
              <h2 className="text-xl font-bold text-white capitalize">
                {selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))} className="p-2 hover:bg-slate-800 rounded-full">
                <ChevronRight />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-sm text-slate-500 mb-2">
              <div>D</div><div>L</div><div>M</div><div>X</div><div>J</div><div>V</div><div>S</div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {renderCalendar()}
            </div>

            <div className="mt-6 flex gap-4 text-xs justify-center text-slate-400">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-900 border border-blue-500 rounded"></div>
                Pecho/Espalda
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-900 border border-green-500 rounded"></div>
                Hombro/Brazos
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-900 border border-red-500 rounded"></div>
                Pierna
              </div>
            </div>
          </div>
        )}

        {/* Log */}
        {view === 'log' && (
          <div className="animate-fade-in pb-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Registrar Sesión</h2>
              <input 
                type="date" 
                value={logDate} 
                onChange={(e) => setLogDate(e.target.value)}
                className="bg-slate-800 text-white p-2 rounded border border-slate-700 text-sm disabled:opacity-50" 
                disabled={!userId}
              />
            </div>

            {/* Selector de Split */}
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">Grupo Muscular Arnold Split</label>
              <div className="flex flex-wrap gap-2">
                {Object.keys(ARNOLD_SPLIT).map((split) => (
                  <button
                    key={split}
                    onClick={() => userId ? setSelectedSplit(split) : setShowAuthModal(true)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedSplit === split 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    } ${!userId ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!userId}
                  >
                    {split}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Ejercicios Agregados */}
            <div className="space-y-6">
              {currentExercises.map((exercise, exIndex) => (
                <div key={exercise.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="flex justify-between items-center mb-3">
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
                      className="bg-transparent text-lg font-semibold text-white focus:outline-none w-full disabled:opacity-50"
                      disabled={!userId}
                    />
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

                  <div className="space-y-2">
                    <div className="grid grid-cols-6 gap-2 text-xs text-slate-500 uppercase tracking-wider text-center">
                      <div className="col-span-1">Set</div>
                      <div className="col-span-2">Kg</div>
                      <div className="col-span-2">Reps</div>
                      <div className="col-span-1"></div>
                    </div>
                    {exercise.sets.map((set, setIndex) => (
                      <div key={setIndex} className="grid grid-cols-6 gap-2 items-center">
                        <div className="text-center text-slate-500 font-mono text-sm">{setIndex + 1}</div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            placeholder="0"
                            value={set.weight}
                            onChange={(e) => updateSet(exIndex, setIndex, 'weight', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-center text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                            disabled={!userId}
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            placeholder="0"
                            value={set.reps}
                            onChange={(e) => updateSet(exIndex, setIndex, 'reps', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-center text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                            disabled={!userId}
                          />
                        </div>
                        <div className="text-center">
                          <button
                            onClick={() => removeSet(exIndex, setIndex)}
                            className="text-slate-600 hover:text-red-400 disabled:opacity-50"
                            disabled={!userId}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => addSet(exIndex)}
                      className="w-full py-2 mt-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-dashed border-slate-600 hover:border-slate-500 transition-all disabled:opacity-50"
                      disabled={!userId}
                    >
                      AGREGAR SERIE
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Agregar nuevo ejercicio */}
            <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
              {!userId && 'opacity-50 pointer-events-none'}
              <p className="text-sm text-slate-400 mb-3">Agregar Ejercicio Sugerido para {selectedSplit}</p>
              <div className="flex flex-wrap gap-2">
                {ARNOLD_SPLIT[selectedSplit].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => handleAddExercise(ex)}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
                    disabled={!userId}
                  >
                    {ex}
                  </button>
                ))}
                <button
                  onClick={() => handleAddExercise('Nuevo Ejercicio')}
                  className="text-xs bg-slate-900 border border-slate-600 hover:border-white text-slate-300 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
                  disabled={!userId}
                >
                  Personalizado
                </button>
              </div>
            </div>

            <button
              onClick={saveWorkout}
              className="w-full mt-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 sticky bottom-24 md:static disabled:opacity-50"
              disabled={!userId}
            >
              <Save className="w-5 h-5" />
              GUARDAR EN LA NUBE
            </button>
            {!userId && (
              <p className="text-center text-sm text-yellow-500 mt-2">
                Debes iniciar sesión con Google para guardar tu progreso.
              </p>
            )}
          </div>
        )}

        {/* Stats */}
        {view === 'stats' && (
          <div className="space-y-6 animate-fade-in pb-10">
            {!userId && (
              <div className="bg-red-900/50 text-red-300 p-3 rounded-lg mb-6 border border-red-700 flex items-center justify-center gap-2">
                <BarChart2 className="w-5 h-5" />
                <p className="text-sm font-medium">Inicia sesión para ver tu historial y estadísticas.</p>
              </div>
            )}

            {/* Gráfico 1: Ejercicio Específico */}
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              {!userId && 'opacity-50'}
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="text-emerald-400" />
                Progreso por Ejercicio
              </h2>
              <div className="mb-6">
                <label className="block text-sm text-slate-400 mb-2">Seleccionar Ejercicio</label>
                <select
                  value={statExercise}
                  onChange={(e) => setStatExercise(e.target.value)}
                  className="w-full bg-slate-800 text-white p-3 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  disabled={!userId}
                >
                  {allExercisesList.map((ex) => (
                    <option key={ex} value={ex}>{ex}</option>
                  ))}
                </select>
              </div>
              <div className="h-64 w-full">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 flex-col">
                    <BarChart2 className="w-10 h-10 mb-2 opacity-50" />
                    <p>{userId ? 'No hay suficientes datos para este ejercicio.' : 'Inicia sesión para cargar datos.'}</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={(str) => str.slice(5)} />
                      <YAxis stroke="#94a3b8" fontSize={12} unit="kg" />
                      <Tooltip contentStyle={{ backgroundColor: '0f172a', borderColor: '1e293b', color: 'f1f5f9' }} />
                      <Line type="monotone" dataKey="weight" name="Peso Máximo" stroke="#34d399" strokeWidth={3} dot={{ fill: '#34d399' }} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Nav móvil */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-2 md:hidden">
        <div className="flex justify-around items-center">
          <button onClick={() => setView('dashboard')} className={`p-2 rounded-lg flex flex-col items-center gap-1 ${view === 'dashboard' ? 'text-emerald-400' : 'text-slate-500'}`}>
            <Activity size={20} />
            <span className="text-[10px]">Inicio</span>
          </button>
          <button onClick={() => setView('calendar')} className={`p-2 rounded-lg flex flex-col items-center gap-1 ${view === 'calendar' ? 'text-emerald-400' : 'text-slate-500'}`}>
            <Calendar size={20} />
            <span className="text-[10px]">Calendario</span>
          </button>
          <button
            onClick={() => {
              if (!userId) {
                setShowAuthModal(true)
                return
              }
              setLogDate(formatDate(new Date()))
              setView('log')
            }}
            className={`bg-emerald-600 text-white p-3 rounded-full -mt-8 shadow-lg shadow-emerald-900/50 border-4 border-slate-950 transition-all ${!userId ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!userId}
          >
            <Plus size={24} />
          </button>
          <button onClick={() => setView('stats')} className={`p-2 rounded-lg flex flex-col items-center gap-1 ${view === 'stats' ? 'text-emerald-400' : 'text-slate-500'}`}>
            <BarChart2 size={20} />
            <span className="text-[10px]">Progreso</span>
          </button>
          <button onClick={handleSignOut} className="p-2 rounded-lg flex flex-col items-center gap-1 text-slate-500 hover:text-red-400">
            <LogOut size={20} />
            <span className="text-[10px]">Salir</span>
          </button>
        </div>
      </nav>

      {/* Nav desktop */}
      <nav className="hidden md:flex fixed left-0 top-20 bottom-0 w-20 flex-col items-center py-8 gap-8 border-r border-slate-800/50">
        {showAuthModal && 'pointer-events-none'}
        <button onClick={() => setView('dashboard')} className={`p-3 rounded-xl transition-all ${view === 'dashboard' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500 hover:bg-slate-800'}`}>
          <Activity size={24} />
        </button>
        <button onClick={() => setView('calendar')} className={`p-3 rounded-xl transition-all ${view === 'calendar' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500 hover:bg-slate-800'}`}>
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
          className={`p-3 rounded-xl transition-all ${view === 'log' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500 hover:bg-slate-800'}`}
        >
          <Plus size={24} />
        </button>
        <button onClick={() => setView('stats')} className={`p-3 rounded-xl transition-all ${view === 'stats' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500 hover:bg-slate-800'}`}>
          <BarChart2 size={24} />
        </button>
        <button onClick={handleSignOut} className="mt-8 p-3 rounded-xl transition-all text-slate-500 hover:bg-red-900/20 hover:text-red-400" title="Cerrar Sesión">
          <LogOut size={24} />
        </button>
      </nav>
    </div>
  )
}

export default App
