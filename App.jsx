import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, BarChart2, Save, Trash2, Dumbbell, ChevronLeft, ChevronRight, Activity, TrendingUp, Layers, Loader, Cloud } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query } from 'firebase/firestore';

// --- Utilitarios de Fecha ---
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const formatDate = (date) => date.toISOString().split('T')[0];

// --- Definición del Arnold Split ---
const ARNOLD_SPLIT = {
  'Pecho y Espalda': ['Press Banca', 'Remo con Barra', 'Press Inclinado', 'Dominadas', 'Aperturas', 'Pull Over'],
  'Hombros y Brazos': ['Press Militar', 'Elevaciones Laterales', 'Curl con Barra', 'Press Francés', 'Curl Martillo', 'Extensiones Tríceps'],
  'Pierna': ['Sentadilla', 'Peso Muerto Rumano', 'Prensa', 'Extensiones de Cuádriceps', 'Curl Femoral', 'Pantorrillas']
};

const App = () => {
  // --- Estados de la Aplicación ---
  const [view, setView] = useState('dashboard'); // dashboard, calendar, log, stats
  const [workouts, setWorkouts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Estado para el formulario de registro
  const [logDate, setLogDate] = useState(formatDate(new Date()));
  const [selectedSplit, setSelectedSplit] = useState('Pecho y Espalda');
  const [currentExercises, setCurrentExercises] = useState([]);

  // --- Estados de Firebase ---
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Configuraciones de Firebase (Acceso a variables globales de Canvas)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
  const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

  // --- 1. Inicialización y Autenticación de Firebase ---
  useEffect(() => {
    if (!firebaseConfig) {
        console.error("Firebase config is missing. Cannot initialize database.");
        setIsLoading(false);
        return;
    }

    const app = initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    const authInstance = getAuth(app);
    setDb(firestore);
    setAuth(authInstance);

    // Manejar autenticación
    const authenticate = async () => {
        try {
            if (initialAuthToken) {
                await signInWithCustomToken(authInstance, initialAuthToken);
            } else {
                await signInAnonymously(authInstance);
            }
        } catch (error) {
            console.error("Firebase authentication failed:", error);
            // Fallback to anonymous sign-in if token fails
            try {
                await signInAnonymously(authInstance);
            } catch (e) {
                console.error("Anonymous sign-in also failed:", e);
            }
        }
    };

    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        // Fallback for unexpected sign-out, although token should keep it signed in
        setUserId(crypto.randomUUID()); 
      }
      setIsAuthReady(true);
      setIsLoading(false);
    });

    authenticate();
    return () => unsubscribe();
  }, []); // Se ejecuta solo una vez al montar

  // --- 2. Carga de Datos en Tiempo Real (onSnapshot) ---
  useEffect(() => {
    if (!isAuthReady || !db || !userId) {
      // Esperar hasta que la autenticación esté lista
      return;
    }
    
    // Ruta de la colección: /artifacts/{appId}/users/{userId}/workouts
    const workoutsCollectionRef = collection(db, 'artifacts', appId, 'users', userId, 'workouts');
    const q = query(workoutsCollectionRef);

    // Escucha en tiempo real
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedWorkouts = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Asegurarse de que el formato de datos sea correcto, si es necesario, parsear.
        loadedWorkouts.push(data);
      });
      setWorkouts(loadedWorkouts);
      console.log(`Workouts loaded: ${loadedWorkouts.length}`);
    }, (error) => {
      console.error("Error fetching workouts from Firestore:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, db, userId, appId]); // Se ejecuta cuando la autenticación esté lista

  // --- Lógica del Calendario ---
  const renderCalendar = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    // Relleno días vacíos
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-10"></div>);
    }

    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDayString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const workoutOnDay = workouts.find(w => w.date === currentDayString);
      
      let bgClass = "bg-slate-800 hover:bg-slate-700 text-slate-300";
      if (workoutOnDay) {
        if (workoutOnDay.split.includes('Pierna')) bgClass = "bg-red-900/80 border border-red-500 text-white font-bold";
        else if (workoutOnDay.split.includes('Pecho')) bgClass = "bg-blue-900/80 border border-blue-500 text-white font-bold";
        else bgClass = "bg-green-900/80 border border-green-500 text-white font-bold";
      }

      days.push(
        <button 
          key={day} 
          onClick={() => {
            setLogDate(currentDayString);
            setView('log');
          }}
          className={`h-10 w-10 md:h-14 md:w-14 rounded-lg flex items-center justify-center text-sm transition-all ${bgClass}`}
        >
          {day}
        </button>
      );
    }
    return days;
  };

  // --- Lógica de Registro (Logger) ---
  const handleAddExercise = (exerciseName) => {
    setCurrentExercises([...currentExercises, { 
      id: Date.now(), 
      name: exerciseName, 
      sets: [{ weight: '', reps: '' }] 
    }]);
  };

  const updateSet = (exerciseIndex, setIndex, field, value) => {
    const newExercises = [...currentExercises];
    newExercises[exerciseIndex].sets[setIndex][field] = value;
    setCurrentExercises(newExercises);
  };

  const addSet = (exerciseIndex) => {
    const newExercises = [...currentExercises];
    newExercises[exerciseIndex].sets.push({ weight: '', reps: '' });
    setCurrentExercises(newExercises);
  };

  const removeSet = (exerciseIndex, setIndex) => {
    const newExercises = [...currentExercises];
    newExercises[exerciseIndex].sets.splice(setIndex, 1);
    setCurrentExercises(newExercises);
  };

  // --- 3. Guardar en Firestore ---
  const saveWorkout = async () => {
    if (!db || !userId) {
      alert('Error: La base de datos no está lista. Intenta de nuevo.');
      return;
    }

    const newWorkout = {
      id: Date.now(),
      date: logDate,
      split: selectedSplit,
      exercises: currentExercises.map(ex => ({
          ...ex,
          sets: ex.sets.filter(s => parseFloat(s.weight) > 0 || parseFloat(s.reps) > 0)
      })).filter(ex => ex.sets.length > 0)
    };

    if (newWorkout.exercises.length === 0) {
        alert('Por favor, agrega al menos un set válido para guardar el entrenamiento.');
        return;
    }

    try {
        const docRef = doc(db, 'artifacts', appId, 'users', userId, 'workouts', logDate);
        await setDoc(docRef, newWorkout);
        
        setView('calendar');
        setCurrentExercises([]);
        // Usar un componente modal en lugar de alert() en un entorno real
        console.log('¡Entrenamiento guardado con éxito en Firestore!'); 
    } catch (error) {
        console.error("Error saving workout to Firestore:", error);
        alert('Error al guardar el entrenamiento. Verifica tu conexión.');
    }
  };

  // Cargar ejercicios si editamos un día existente
  useEffect(() => {
    if (view === 'log') {
      const existingWorkout = workouts.find(w => w.date === logDate);
      if (existingWorkout) {
        setSelectedSplit(existingWorkout.split);
        setCurrentExercises(existingWorkout.exercises);
      } else {
        setCurrentExercises([]);
      }
    }
  }, [logDate, view, workouts]); // Dependencia 'workouts' para actualizar al cargar de la DB

  // --- Lógica de Estadísticas (sin cambios en el cálculo) ---
  const [statExercise, setStatExercise] = useState('Press Banca');
  
  // Datos para Gráfico 1: Ejercicio Individual (Peso Máximo)
  const chartData = useMemo(() => {
    const dataPoints = [];
    workouts.sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(workout => {
      workout.exercises.forEach(ex => {
        if (ex.name === statExercise) {
          const maxWeight = Math.max(...ex.sets.map(s => parseFloat(s.weight) || 0));
          if (maxWeight > 0) {
            dataPoints.push({ date: workout.date, weight: maxWeight });
          }
        }
      });
    });
    return dataPoints;
  }, [workouts, statExercise]);

  // Datos para Gráfico 2: Promedio General por Grupo Muscular
  const overallProgressData = useMemo(() => {
    const dataPoints = [];
    
    // Paso 1: Acumular datos por fecha y split
    const progressMap = {}; // { date: { 'Pecho y Espalda': avgWeight, 'Pierna': avgWeight, ... } }

    const sortedWorkouts = [...workouts].sort((a,b) => new Date(a.date) - new Date(b.date));

    sortedWorkouts.forEach(workout => {
      let totalWeight = 0;
      let totalSets = 0;

      workout.exercises.forEach(ex => {
        ex.sets.forEach(set => {
          const w = parseFloat(set.weight) || 0;
          if (w > 0) {
            totalWeight += w;
            totalSets += 1;
          }
        });
      });

      const averageWeight = totalSets > 0 ? Math.round(totalWeight / totalSets) : 0;

      if (averageWeight > 0) {
        // Inicializar el objeto para la fecha si no existe
        if (!progressMap[workout.date]) {
          progressMap[workout.date] = { date: workout.date };
        }
        // Asignar el promedio al split del día
        progressMap[workout.date][workout.split] = averageWeight;
      }
    });

    // Paso 2: Convertir el mapa a un array de puntos de datos para Recharts
    Object.keys(progressMap).forEach(date => {
        dataPoints.push(progressMap[date]);
    });

    return dataPoints;
  }, [workouts]);


  const allExercisesList = useMemo(() => {
    const set = new Set();
    Object.values(ARNOLD_SPLIT).flat().forEach(ex => set.add(ex));
    workouts.forEach(w => w.exercises.forEach(e => set.add(e.name)));
    return Array.from(set).sort();
  }, [workouts]);
  
  // --- Renderizado principal con estado de carga ---
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="flex flex-col items-center p-8 bg-slate-900 rounded-xl shadow-2xl">
          <Loader className="w-10 h-10 text-emerald-400 animate-spin" />
          <p className="mt-4 text-lg font-semibold">Cargando datos desde la nube...</p>
          <p className="text-sm text-slate-500 mt-1">Conectando a Firebase...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-slate-900 p-4 border-b border-slate-800 sticky top-0 z-10 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
            <Dumbbell className="text-blue-400" /> Arnold Tracker
          </h1>
          <div className="text-xs text-slate-500 hidden md:flex items-center gap-2">
            <Cloud className='w-4 h-4 text-emerald-400'/>
            Datos Guardados en la Nube
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        
        {/* --- VISTA: DASHBOARD --- */}
        {view === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-sm">Entrenos Totales</div>
                <div className="text-3xl font-bold text-white">{workouts.length}</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-sm">Último Entreno</div>
                <div className="text-lg font-bold text-emerald-400">
                  {workouts.length > 0 
                    ? workouts.sort((a,b) => new Date(b.date) - new Date(a.date))[0].split 
                    : 'Sin datos'}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <h2 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" /> Actividad Reciente
              </h2>
              <div className="space-y-3">
                {workouts.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 3).map(workout => (
                  <div key={workout.id} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg">
                    <div>
                      <div className="font-medium text-white">{workout.split}</div>
                      <div className="text-xs text-slate-400">{workout.date}</div>
                    </div>
                    <div className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                      {workout.exercises.length} Ejercicios
                    </div>
                  </div>
                ))}
                {workouts.length === 0 && <p className="text-slate-500 italic">No hay entrenamientos recientes.</p>}
              </div>
            </div>
            
            <button 
              onClick={() => {
                setLogDate(formatDate(new Date()));
                setView('log');
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-6 h-6" /> Registrar Entrenamiento de Hoy
            </button>
          </div>
        )}

        {/* --- VISTA: CALENDARIO --- */}
        {view === 'calendar' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))} className="p-2 hover:bg-slate-800 rounded-full">
                <ChevronLeft />
              </button>
              <h2 className="text-xl font-bold text-white capitalize">
                {selectedDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
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
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-900 border border-blue-500 rounded"></div> Pecho/Espalda</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-900 border border-green-500 rounded"></div> Hombro/Brazos</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-900 border border-red-500 rounded"></div> Pierna</div>
            </div>
          </div>
        )}

        {/* --- VISTA: LOGGER (REGISTRO) --- */}
        {view === 'log' && (
          <div className="animate-fade-in pb-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Registrar Sesión</h2>
              <input 
                type="date" 
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="bg-slate-800 text-white p-2 rounded border border-slate-700 text-sm"
              />
            </div>

            {/* Selector de Split */}
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">Grupo Muscular (Arnold Split)</label>
              <div className="flex flex-wrap gap-2">
                {Object.keys(ARNOLD_SPLIT).map(split => (
                  <button
                    key={split}
                    onClick={() => setSelectedSplit(split)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedSplit === split 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
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
                        const newEx = [...currentExercises];
                        newEx[exIndex].name = e.target.value;
                        setCurrentExercises(newEx);
                      }}
                      className="bg-transparent text-lg font-semibold text-white focus:outline-none w-full"
                    />
                    <button 
                      onClick={() => {
                        const newEx = [...currentExercises];
                        newEx.splice(exIndex, 1);
                        setCurrentExercises(newEx);
                      }}
                      className="text-red-500 hover:text-red-400 p-1"
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
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-center text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            placeholder="0"
                            value={set.reps}
                            onChange={(e) => updateSet(exIndex, setIndex, 'reps', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-center text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <button onClick={() => removeSet(exIndex, setIndex)} className="text-slate-600 hover:text-red-400">×</button>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => addSet(exIndex)}
                      className="w-full py-2 mt-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded dashed border border-slate-600 hover:border-slate-500 transition-all"
                    >
                      + AGREGAR SERIE
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Agregar nuevo ejercicio */}
            <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
              <p className="text-sm text-slate-400 mb-3">Agregar Ejercicio Sugerido para {selectedSplit}:</p>
              <div className="flex flex-wrap gap-2">
                {ARNOLD_SPLIT[selectedSplit].map(ex => (
                  <button
                    key={ex}
                    onClick={() => handleAddExercise(ex)}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-full transition-colors"
                  >
                    + {ex}
                  </button>
                ))}
                <button
                   onClick={() => handleAddExercise('Nuevo Ejercicio')}
                   className="text-xs bg-slate-900 border border-slate-600 hover:border-white text-slate-300 px-3 py-1.5 rounded-full transition-colors"
                >
                  + Personalizado
                </button>
              </div>
            </div>

            <button 
              onClick={saveWorkout}
              className="w-full mt-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 sticky bottom-24 md:static"
              disabled={!isAuthReady}
            >
              <Save className="w-5 h-5" /> GUARDAR EN LA NUBE
            </button>
            
            {!isAuthReady && (
                <p className="text-center text-sm text-yellow-500">Conectando a la base de datos...</p>
            )}
          </div>
        )}

        {/* --- VISTA: ESTADÍSTICAS --- */}
        {view === 'stats' && (
          <div className="space-y-6 animate-fade-in pb-10">
            {/* Gráfico 1: Ejercicio Específico */}
             <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="text-emerald-400" /> Progreso por Ejercicio
                </h2>
                
                <div className="mb-6">
                  <label className="block text-sm text-slate-400 mb-2">Seleccionar Ejercicio</label>
                  <select 
                    value={statExercise}
                    onChange={(e) => setStatExercise(e.target.value)}
                    className="w-full bg-slate-800 text-white p-3 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
                  >
                    {allExercisesList.map(ex => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                  </select>
                </div>

                <div className="h-64 w-full">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={(str) => str.slice(5)} />
                        <YAxis stroke="#94a3b8" fontSize={12} unit="kg" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }} 
                          itemStyle={{ color: '#34d399' }}
                        />
                        <Line type="monotone" dataKey="weight" name="Peso Máximo" stroke="#34d399" strokeWidth={3} dot={{ fill: '#34d399' }} activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 flex-col">
                      <BarChart2 className="w-10 h-10 mb-2 opacity-50" />
                      <p>No hay suficientes datos para este ejercicio.</p>
                    </div>
                  )}
                </div>
             </div>

             {/* Gráfico 2: Tendencia General (Los 3 grupos) */}
             <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Layers className="text-blue-400" /> Tendencia General por Grupo
                </h2>
                <p className="text-xs text-slate-400 mb-4">Promedio de peso levantado (Kg) por sesión en cada grupo muscular.</p>

                <div className="h-64 w-full">
                  {overallProgressData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overallProgressData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={(str) => str.slice(5)} />
                        <YAxis stroke="#94a3b8" fontSize={12} unit="kg" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }} 
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        
                        {/* Pecho y Espalda (Azul) */}
                        <Line connectNulls type="monotone" dataKey="Pecho y Espalda" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} />
                        
                        {/* Hombros y Brazos (Verde/Esmeralda) */}
                        <Line connectNulls type="monotone" dataKey="Hombros y Brazos" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} />
                        
                        {/* Pierna (Rojo) */}
                        <Line connectNulls type="monotone" dataKey="Pierna" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444' }} />
                      
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 flex-col">
                      <Activity className="w-10 h-10 mb-2 opacity-50" />
                      <p>Registra entrenamientos variados para ver la comparativa.</p>
                    </div>
                  )}
                </div>
             </div>
          </div>
        )}
      </main>

      {/* --- MENU DE NAVEGACIÓN INFERIOR (MÓVIL) --- */}
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
             onClick={() => { setLogDate(formatDate(new Date())); setView('log'); }}
             className="bg-emerald-600 text-white p-3 rounded-full -mt-8 shadow-lg shadow-emerald-900/50 border-4 border-slate-950"
          >
            <Plus size={24} />
          </button>
          <button onClick={() => setView('stats')} className={`p-2 rounded-lg flex flex-col items-center gap-1 ${view === 'stats' ? 'text-emerald-400' : 'text-slate-500'}`}>
            <BarChart2 size={20} />
            <span className="text-[10px]">Progreso</span>
          </button>
          {/* Opción extra para equilibrar */}
          <div className="w-10"></div> 
        </div>
      </nav>

      {/* --- MENU DE NAVEGACIÓN LATERAL (DESKTOP) --- */}
      <nav className="hidden md:flex fixed left-0 top-20 bottom-0 w-20 flex-col items-center py-8 gap-8 border-r border-slate-800/50">
          <button onClick={() => setView('dashboard')} className={`p-3 rounded-xl transition-all ${view === 'dashboard' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500 hover:bg-slate-800'}`}>
            <Activity size={24} />
          </button>
          <button onClick={() => setView('calendar')} className={`p-3 rounded-xl transition-all ${view === 'calendar' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500 hover:bg-slate-800'}`}>
            <Calendar size={24} />
          </button>
          <button onClick={() => setView('log')} className={`p-3 rounded-xl transition-all ${view === 'log' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500 hover:bg-slate-800'}`}>
            <Plus size={24} />
          </button>
          <button onClick={() => setView('stats')} className={`p-3 rounded-xl transition-all ${view === 'stats' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500 hover:bg-slate-800'}`}>
            <BarChart2 size={24} />
          </button>
      </nav>
    </div>
  );
};

export default App;
