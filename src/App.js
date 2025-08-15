import React, { useState, useEffect, createContext, useContext } from 'react';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Plus, X, Sun, Moon, Check, Trash2, Edit, LogIn, LogOut } from 'lucide-react';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, parseISO, toDate, isWithinInterval } from 'date-fns';

const __app_id = 'default-app-id';

// Create a context for the Firestore and Auth objects
const FirebaseContext = createContext(null);

// Component to handle the Firebase setup and provide context to children
const FirebaseProvider = ({ children }) => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    // Your web app's Firebase configuration
    const firebaseConfig = {
      apiKey: "AIzaSyD4G6C-RW4YqP5Jo96gAS64f6dS2aj81ng",
      authDomain: "calendar-app007.firebaseapp.com",
      projectId: "calendar-app007",
      storageBucket: "calendar-app007.firebasestorage.app",
      messagingSenderId: "58738613600",
      appId: "1:58738613600:web:1228a06805d95a23d81205",
      measurementId: "G-KEQ1F4MR2E"
    };

    if (!firebaseConfig.projectId) {
      console.error("Firebase config is missing.");
      return;
    }

    const app = initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    const authService = getAuth(app);
    setDb(firestore);
    setAuth(authService);

    const unsubscribe = onAuthStateChanged(authService, async (authUser) => {
      if (authUser) {
        setUser(authUser);
      } else {
        // Sign in anonymously if no user is authenticated
        try {
          await signInAnonymously(authService);
        } catch (error) {
          console.error("Error signing in anonymously:", error);
        }
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  return (
    <FirebaseContext.Provider value={{ db, auth, user, isAuthReady }}>
      {children}
    </FirebaseContext.Provider>
  );
};

// Main App component
export default function App() {
  // Initialize isDarkMode based on system preference and local storage
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check if a preference is saved in local storage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // If no preference is saved, default to the user's system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Effect to save the theme preference to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    // The adding/removing of 'dark' class is now handled by the main div's className
  }, [isDarkMode]);

// Inside the App function
  return (
    <FirebaseProvider>
      {/* Apply 'dark' class directly to the main container based on state */}
      <div className={`h-screen w-screen font-sans antialiased transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`}>
        <CalendarAppContent isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
      </div>
    </FirebaseProvider>
  );
}

// Main content component to use Firebase context
const CalendarAppContent = ({ isDarkMode, setIsDarkMode }) => {
  const { db, auth, user, isAuthReady } = useContext(FirebaseContext);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('monthly'); // 'monthly', 'weekly', 'daily'
  const [tasks, setTasks] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [todos, setTodos] = useState(['Buy groceries', 'Finish report', 'Call mom']);
  const [completedTodos, setCompletedTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [categories, setCategories] = useState(['Work', 'Personal', 'Education']);
  const [newCategory, setNewCategory] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [isTaskDetailsModalOpen, setIsTaskDetailsModalOpen] = useState(false);
  const [tasksForSelectedDay, setTasksForSelectedDay] = useState([]);

  const categoryColors = {
    'Work': 'bg-red-500',
    'Personal': 'bg-blue-500',
    'Education': 'bg-green-500',
  };

  const today = new Date();
  const timeSlots = Array.from({ length: 24 }, (_, i) => i);

  const handleGoogleSignIn = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      showTemporaryNotification("Signed in successfully with Google!");
    } catch (error) {
      console.error("Google Sign-in Error:", error);
      showTemporaryNotification("Failed to sign in with Google.");
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      showTemporaryNotification("Signed out successfully.");
    } catch (error) {
      console.error("Sign-out Error:", error);
      showTemporaryNotification("Failed to sign out.");
    }
  };

  const showTemporaryNotification = (message) => {
    setNotificationMessage(message);
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };

  useEffect(() => {
    if (db && user && isAuthReady) {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const userId = user.uid;
      const tasksCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/tasks`);
      const q = query(tasksCollectionRef);
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const tasksData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date ? toDate(doc.data().date.toDate()) : null,
          startDate: doc.data().startDate ? toDate(doc.data().startDate.toDate()) : null,
          endDate: doc.data().endDate ? toDate(doc.data().endDate.toDate()) : null,
        }));
        setTasks(tasksData);
      }, (error) => {
        console.error("Error fetching tasks: ", error);
        showTemporaryNotification("Error loading tasks.");
      });
      return () => unsubscribe();
    } else {
      setTasks([]); // Clear tasks if user signs out
    }
  }, [db, user, isAuthReady]);

  const handleTaskSubmit = async (taskData) => {
    if (!db || !user || user.isAnonymous) {
      showTemporaryNotification("Please sign in to add or update tasks.");
      return;
    }
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userId = user.uid;
    try {
      if (taskData.id) {
        const { id, ...dataToUpdate } = taskData;
        const taskDocRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, id);
        await updateDoc(taskDocRef, dataToUpdate);
        showTemporaryNotification("Task updated successfully!");
      } else {
        const tasksCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/tasks`);
        await addDoc(tasksCollectionRef, taskData);
        showTemporaryNotification("Task added successfully!");
      }
      setIsModalOpen(false);
      setSelectedTask(null);
    } catch (e) {
      console.error("Error adding/updating document: ", e);
      showTemporaryNotification("Error saving task.");
    }
  };

  const handleTaskDelete = async (taskId) => {
    if (!db || !user || user.isAnonymous || !taskId) {
      showTemporaryNotification("Please sign in to delete tasks.");
      return;
    }
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userId = user.uid;
    try {
      const taskDocRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, taskId);
      await deleteDoc(taskDocRef);
      showTemporaryNotification("Task deleted successfully!");
      setIsModalOpen(false);
      setIsTaskDetailsModalOpen(false);
      setSelectedTask(null);
    } catch (e) {
      console.error("Error deleting document: ", e);
      showTemporaryNotification("Error deleting task.");
    }
  };

  const handleMarkCompleted = async (taskId) => {
    if (!db || !user || user.isAnonymous || !taskId) {
      showTemporaryNotification("Please sign in to mark tasks as completed.");
      return;
    }
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userId = user.uid;
    try {
      const taskDocRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, taskId);
      await deleteDoc(taskDocRef);
      showTemporaryNotification("Task marked as completed!");
      setIsModalOpen(false);
      setIsTaskDetailsModalOpen(false);
      setSelectedTask(null);
    } catch (e) {
      console.error("Error marking task as completed: ", e);
      showTemporaryNotification("Error marking task as completed.");
    }
  };

  const handleAddTodo = () => {
    if (newTodo.trim() !== '' && todos.length + completedTodos.length < 5) {
      setTodos([...todos, newTodo.trim()]);
      setNewTodo('');
    }
  };

  const handleCompleteTodo = (indexToComplete) => {
    const todoToComplete = todos[indexToComplete];
    setCompletedTodos([...completedTodos, todoToComplete]);
    setTodos(todos.filter((_, index) => index !== indexToComplete));
  };

  const handleRemoveTodo = (indexToRemove, isCompleted) => {
    if (isCompleted) {
      setCompletedTodos(completedTodos.filter((_, index) => index !== indexToRemove));
    } else {
      setTodos(todos.filter((_, index) => index !== indexToRemove));
    }
  };

  const handleAddCategory = () => {
    if (newCategory.trim() !== '' && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (category) => {
    setCategoryToDelete(category);
    setIsConfirmModalOpen(true);
  };

  const confirmRemoveCategory = () => {
    const updatedCategories = categories.filter(cat => cat !== categoryToDelete);
    setCategories(updatedCategories);
    if (selectedCategoryFilter === categoryToDelete) {
      setSelectedCategoryFilter(null);
    }
    setIsConfirmModalOpen(false);
    setCategoryToDelete(null);
  };

  const TaskModal = ({ isOpen, onClose, task, date, onSubmit, onMarkCompleted, onDelete, categories }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [taskDate, setTaskDate] = useState('');
    const [taskStartDate, setTaskStartDate] = useState('');
    const [taskEndDate, setTaskEndDate] = useState('');
    const [taskTime, setTaskTime] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [category, setCategory] = useState('');
    const [backgroundColor, setBackgroundColor] = useState('#8B5CF6');
    const [isMultiDay, setIsMultiDay] = useState(false);

    useEffect(() => {
      if (task) {
        setTitle(task.title || '');
        setDescription(task.description || '');
        setTaskDate(task.date ? format(task.date, 'yyyy-MM-dd') : '');
        setTaskTime(task.date ? format(task.date, 'HH:mm') : '');
        setImageUrl(task.imageUrl || '');
        setLinkUrl(task.linkUrl || '');
        setCategory(task.category || categories[0] || '');
        setBackgroundColor(task.backgroundColor || '#8B5CF6');
        setIsMultiDay(!!task.startDate);
        if (task.startDate && task.endDate) {
          setTaskStartDate(format(task.startDate, 'yyyy-MM-dd'));
          setTaskEndDate(format(task.endDate, 'yyyy-MM-dd'));
        }
      } else {
        setTitle('');
        setDescription('');
        setTaskDate(format(date || today, 'yyyy-MM-dd'));
        setTaskTime('');
        setImageUrl('');
        setLinkUrl('');
        setCategory(categories[0] || '');
        setBackgroundColor('#8B5CF6');
        setIsMultiDay(false);
      }
    }, [task, date, categories, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!title.trim()) {
        showTemporaryNotification("Please enter a task title");
        return;
      }
      const submittedData = {
        title: title.trim(),
        description: description.trim(),
        backgroundColor,
        category,
        imageUrl: imageUrl.trim(),
        linkUrl: linkUrl.trim(),
      };
      if (task && task.id) {
        submittedData.id = task.id;
      }
      if (isMultiDay) {
        submittedData.startDate = parseISO(taskStartDate);
        submittedData.endDate = parseISO(taskEndDate);
        delete submittedData.date;
      } else {
        submittedData.date = parseISO(`${taskDate}T${taskTime || '00:00'}`);
        delete submittedData.startDate;
        delete submittedData.endDate;
      }
      onSubmit(submittedData);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-70 dark:bg-opacity-80">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl w-full max-w-md mx-4 transform transition-all scale-100 overflow-y-auto max-h-[90vh]">
          <div className="flex justify-between items-center mb-4 sticky top-0 bg-white dark:bg-gray-800 pb-2">
            <h2 className="text-2xl font-bold">{task ? 'Edit Task' : 'Add New Task'}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 dark:text-gray-300" htmlFor="title">Title</label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 dark:text-gray-300" htmlFor="description">Description</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                rows="4"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 dark:text-gray-300" htmlFor="backgroundColor">Background Color</label>
              <input
                type="color"
                id="backgroundColor"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="w-full h-10 p-1 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 dark:text-gray-300" htmlFor="category">Category</label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2 mb-4">
                <input
                    type="checkbox"
                    id="isMultiDay"
                    checked={isMultiDay}
                    onChange={(e) => setIsMultiDay(e.target.checked)}
                    className="form-checkbox h-4 w-4 text-blue-600 rounded"
                />
                <label className="text-sm dark:text-gray-300" htmlFor="isMultiDay">Multi-day task</label>
            </div>
            {isMultiDay ? (
                <div className="flex space-x-4 mb-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300" htmlFor="startDate">Start Date</label>
                        <input
                            type="date"
                            id="startDate"
                            value={taskStartDate}
                            onChange={(e) => setTaskStartDate(e.target.value)}
                            className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                            required
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300" htmlFor="endDate">End Date</label>
                        <input
                            type="date"
                            id="endDate"
                            value={taskEndDate}
                            onChange={(e) => setTaskEndDate(e.target.value)}
                            className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                            required
                        />
                    </div>
                </div>
            ) : (
                <div className="flex space-x-4 mb-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300" htmlFor="date">Date</label>
                        <input
                            type="date"
                            id="date"
                            value={taskDate}
                            onChange={(e) => setTaskDate(e.target.value)}
                            className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                            required
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300" htmlFor="time">Time</label>
                        <input
                            type="time"
                            id="time"
                            value={taskTime}
                            onChange={(e) => setTaskTime(e.target.value)}
                            className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                        />
                    </div>
                </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 dark:text-gray-300" htmlFor="imageUrl">Image URL</label>
              <input
                type="url"
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="e.g., https://example.com/image.jpg"
                className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 dark:text-gray-300" htmlFor="linkUrl">Link URL</label>
              <input
                type="url"
                id="linkUrl"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="e.g., https://example.com/document"
                className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-6">
              <button
                type="submit"
                className="bg-blue-500 text-white font-bold py-2 px-6 rounded-full hover:bg-blue-600 transition-colors"
              >
                {task ? 'Update' : 'Add Task'}
              </button>
              {task && (
                <>
                  <button
                    type="button"
                    onClick={() => onMarkCompleted(task.id)}
                    className="bg-green-500 text-white font-bold py-2 px-6 rounded-full hover:bg-green-600 transition-colors flex items-center"
                  >
                    <Check size={16} className="mr-2" /> Complete
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(task.id)}
                    className="bg-red-500 text-white font-bold py-2 px-6 rounded-full hover:bg-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  };

  const ConfirmationModal = ({ isOpen, onClose, onConfirm, message }) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-70 dark:bg-opacity-80">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl w-full max-w-sm mx-4">
          <h3 className="text-lg font-bold mb-4 dark:text-white">Confirmation</h3>
          <p className="mb-6 dark:text-gray-300">{message}</p>
          <div className="flex justify-end space-x-4">
            <button onClick={onClose} className="px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white">Cancel</button>
            <button onClick={onConfirm} className="px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600">Confirm</button>
          </div>
        </div>
      </div>
    );
  };

  const TaskDetailsModal = ({ isOpen, onClose, tasksForDay, onMarkCompleted, onEdit, onDelete }) => {
    const [activeTask, setActiveTask] = useState(null);
    useEffect(() => {
      if (tasksForDay.length > 0) {
        setActiveTask(tasksForDay[0]);
      } else {
        setActiveTask(null);
      }
    }, [tasksForDay]);

    if (!isOpen || tasksForDay.length === 0) return null;

    const formatTaskDate = (task) => {
      if (task.date) {
        return format(task.date, 'EEEE, MMMM d, yyyy h:mm a');
      }
      if (task.startDate && task.endDate) {
        return `${format(task.startDate, 'MMM d')} - ${format(task.endDate, 'MMM d, yyyy')}`;
      }
      return 'No date specified';
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-70 dark:bg-opacity-80">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl w-full max-w-6xl mx-4 transform transition-all scale-100 overflow-hidden h-[90vh] flex">
          <div className="w-1/3 border-r dark:border-gray-700 pr-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold dark:text-white">
                Tasks for {tasksForDay[0]?.date ? format(tasksForDay[0].date, 'MMM d, yyyy') :
                     tasksForDay[0]?.startDate ? format(tasksForDay[0].startDate, 'MMM d, yyyy') : 'Selected Date'}
              </h3>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                <X size={24} />
              </button>
            </div>
            <button
              onClick={() => {
                onClose();
                setIsModalOpen(true);
                setSelectedTask(null);
                setSelectedDate(tasksForDay[0]?.date || tasksForDay[0]?.startDate || today);
              }}
              className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-full flex items-center justify-center mb-4 hover:bg-blue-600 transition-colors"
            >
              <Plus size={20} className="mr-2" /> Add New Task
            </button>
            <ul className="space-y-2">
              {tasksForDay.map(task => (
                <li
                  key={task.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    activeTask?.id === task.id
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setActiveTask(task)}
                >
                  <p className="font-semibold truncate dark:text-white">{task.title}</p>
                  <p className="text-sm opacity-75 dark:text-gray-300">
                    {task.date ? format(task.date, 'h:mm a') :
                     task.startDate ? 'Multi-day' : 'All Day'}
                  </p>
                  <div
                    className="w-3 h-3 rounded-full mt-1"
                    style={{ backgroundColor: activeTask.backgroundColor || '#8B5CF6' }}
                  />
                </li>
              ))}
            </ul>
          </div>
          <div className="w-2/3 pl-6 overflow-y-auto">
            {activeTask ? (
              <div>
                <h2 className="text-3xl font-bold mb-2 dark:text-white">{activeTask.title}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {formatTaskDate(activeTask)}
                </p>
                {activeTask.category && (
                  <div className="mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 dark:text-white">
                      <div
                        className="w-2 h-2 rounded-full mr-2"
                        style={{ backgroundColor: activeTask.backgroundColor || '#8B5CF6' }}
                      />
                      {activeTask.category}
                    </span>
                  </div>
                )}
                {activeTask.description && (
                  <div className="mb-6">
                    <h4 className="font-semibold mb-2 dark:text-white">Description</h4>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {activeTask.description}
                    </p>
                  </div>
                )}
                {activeTask.imageUrl && (
                  <div className="mb-6">
                    <h4 className="font-semibold mb-2 dark:text-white">Attached Image</h4>
                    <img
                      src={activeTask.imageUrl}
                      alt="Task attachment"
                      className="rounded-lg max-w-full h-auto shadow-md"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                {activeTask.linkUrl && (
                  <div className="mb-6">
                    <h4 className="font-semibold mb-2 dark:text-white">Attached Link</h4>
                    <a
                      href={activeTask.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center"
                    >
                      <span className="mr-1"><X size={16} /></span>
                      Attached Link
                    </a>
                  </div>
                )}
                <div className="flex space-x-2">
                  <button
                    onClick={() => onMarkCompleted(activeTask.id)}
                    className="bg-green-500 text-white font-bold py-2 px-4 rounded-full flex items-center"
                  >
                    <Check size={20} className="mr-2" /> Mark Completed
                  </button>
                  <button
                    onClick={() => onEdit(activeTask)}
                    className="bg-yellow-500 text-white font-bold py-2 px-4 rounded-full flex items-center"
                  >
                    <Edit size={20} className="mr-2" /> Edit
                  </button>
                  <button
                    onClick={() => onDelete(activeTask.id)}
                    className="bg-red-500 text-white font-bold py-2 px-6 rounded-full hover:bg-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-20">
                No task selected.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthlyView = () => {
    const startOfMonthView = startOfWeek(startOfMonth(currentDate));
    const endOfMonthView = endOfWeek(endOfMonth(currentDate));
    const days = [];
    let day = startOfMonthView;
    while (day <= endOfMonthView) {
      days.push(day);
      day = addDays(day, 1);
    }
    const totalCells = 42;
    while (days.length < totalCells) {
      days.push(addDays(days[days.length - 1], 1));
    }
    const handleDayClick = (day) => {
        const tasksOnDay = tasks.filter(task => {
            if (task.date) return isSameDay(task.date, day);
            if (task.startDate && task.endDate) return isWithinInterval(day, { start: task.startDate, end: task.endDate });
            return false;
        });
        if (tasksOnDay.length > 1) {
            setTasksForSelectedDay(tasksOnDay);
            setIsTaskDetailsModalOpen(true);
        } else {
            setSelectedDate(day);
            setIsModalOpen(true);
            setSelectedTask(tasksOnDay[0] || null);
        }
    };
    const renderTasksForDay = (day) => {
        const tasksOnDay = tasks.filter(task => {
            if (task.date) {
                return isSameDay(task.date, day);
            }
            if (task.startDate && task.endDate) {
                return isWithinInterval(day, { start: task.startDate, end: task.endDate });
            }
            return false;
        });
        const filteredTasks = tasksOnDay.filter(task => !selectedCategoryFilter || task.category === selectedCategoryFilter);
        return (
            <>
                {filteredTasks.map((task, index) => (
                    <div
                        key={`${task.id}-${index}`}
                        className="rounded-md p-1 text-xs mb-1 truncate cursor-pointer hover:opacity-80 transition-opacity text-white"
                        style={{ backgroundColor: task.backgroundColor }}
                        onClick={(e) => { e.stopPropagation(); setSelectedTask(task); setIsModalOpen(true); }}
                    >
                        {task.title}
                    </div>
                ))}
            </>
        );
    };
    return (
      <div
        className="flex-1 p-4 grid grid-cols-7 gap-1 h-full overflow-y-auto"
      >
        {days.map((day) => {
           const hasTasksForFilteredCategory = tasks.some(task => (task.date && isSameDay(task.date, day) || (task.startDate && isWithinInterval(day, { start: task.startDate, end: task.endDate }))) && task.category === selectedCategoryFilter);
           const isCurrentMonth = isSameMonth(day, currentDate);
           const isToday = isSameDay(day, today);
           const dayColor = getDayColor(day);
           const categoryHighlightClass = selectedCategoryFilter && hasTasksForFilteredCategory
               ? isDarkMode ? 'ring-2 ring-yellow-400' : 'ring-2 ring-red-500'
               : '';
           const dayClass = `
             relative h-32 p-2 rounded-lg cursor-pointer
             ${isCurrentMonth ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-850 text-gray-400 dark:text-gray-600'}
             ${isToday ? 'ring-2 ring-blue-500' : ''}
             ${categoryHighlightClass}
             transition-all duration-200
           `;
           return (
             <div
               key={day.toString()}
               className={dayClass}
               onClick={() => handleDayClick(day)}
               style={dayColor ? {backgroundColor: dayColor, color: '#fff'} : {}}
             >
               <span className="text-sm font-semibold">{format(day, "d")}</span>
               <div className="flex-grow overflow-y-auto mt-2 space-y-1">
                {renderTasksForDay(day)}
               </div>
             </div>
           );
         })}
      </div>
    );
  };

  const renderWeeklyView = () => {
    const startWeek = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(startWeek, i));
    const renderEventsForWeek = (day) => {
        const tasksForDay = tasks.filter(task => {
            if (task.date) return isSameDay(task.date, day);
            return false;
        }).filter(task => !selectedCategoryFilter || task.category === selectedCategoryFilter);
        return tasksForDay.map((task, index) => (
             <div
                key={`${task.id}-${index}`}
                className="w-full p-2 rounded-lg text-white text-xs cursor-pointer shadow-md transition-shadow hover:shadow-lg mb-2"
                style={{ backgroundColor: task.backgroundColor || `rgba(139, 92, 246, 0.7)` }}
                onClick={() => { setSelectedTask(task); setIsModalOpen(true); }}
            >
                <p className="font-semibold">{task.title}</p>
                <p className="mt-1">{task.date ? format(task.date, 'h:mm a') : 'All Day'}</p>
            </div>
        ));
    };
    return (
        <div className="flex flex-col flex-1 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 mb-2">
                {days.map(day => {
                    const isToday = isSameDay(day, today);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    return (
                        <div
                            key={day.toString()}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer
                                ${isToday ? 'bg-blue-500 text-white' : 'text-gray-600 dark:text-gray-300'}
                                ${isSelected ? 'bg-blue-200 dark:bg-blue-800' : ''}
                            `}
                            onClick={() => setSelectedDate(day)}
                        >
                            <span className="text-sm uppercase font-semibold">{format(day, "EEE")}</span>
                            <span className={`text-2xl font-bold mt-1`}>{format(day, "d")}</span>
                        </div>
                    );
                })}
            </div>
            <div className="flex-1 grid grid-cols-7 gap-2 overflow-y-auto p-2">
                {days.map(day => {
                       const hasTasksForFilteredCategory = tasks.some(task => (task.date && isSameDay(task.date, day) || (task.startDate && isWithinInterval(day, { start: task.startDate, end: task.endDate }))) && task.category === selectedCategoryFilter);
                       const categoryHighlightClass = selectedCategoryFilter && hasTasksForFilteredCategory
                           ? isDarkMode ? 'ring-2 ring-yellow-400' : 'ring-2 ring-red-500'
                           : '';
                        return (
                            <div key={day.toString()} className={`h-full border-r border-gray-200 dark:border-gray-700 relative p-2 ${categoryHighlightClass}`}>
                                {renderEventsForWeek(day)}
                            </div>
                        );
                    })}
                </div>
        </div>
    );
  };

  const renderDailyView = () => {
    const dayTasks = tasks.filter(task => task.date && isSameDay(task.date, currentDate) && (!selectedCategoryFilter || task.category === selectedCategoryFilter)).sort((a, b) => a.date - b.date);
    return (
      <div className="flex flex-col flex-1 p-4 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2">
            {dayTasks.map(task => {
                return (
                    <div
                        key={task.id}
                        className="w-full p-2 rounded-lg text-white text-xs cursor-pointer shadow-md transition-shadow hover:shadow-lg mb-2"
                        style={{ backgroundColor: task.backgroundColor || `rgba(139, 92, 246, 0.7)` }}
                        onClick={() => { setSelectedTask(task); setIsModalOpen(true); }}
                    >
                        <p className="font-semibold">{task.title}</p>
                        <p className="mt-1">{task.date ? format(task.date, 'h:mm a') : 'All Day'}</p>
                    </div>
                );
            })}
        </div>
      </div>
    );
  };

  const renderView = () => {
    switch (view) {
      case 'monthly':
        return renderMonthlyView();
      case 'weekly':
        return renderWeeklyView();
      case 'daily':
        return renderDailyView();
      default:
        return null;
    }
  };

  const getDayColor = (day) => {
    const tasksOnDay = tasks.filter(task => {
        if (task.startDate && task.endDate) {
            return isWithinInterval(day, { start: task.startDate, end: task.endDate });
        }
        return task.date && isSameDay(task.date, day);
    });
    if (tasksOnDay.length > 0) {
        return tasksOnDay[0].backgroundColor || '#8B5CF6';
    }
    return null;
  };

  const clearSelection = () => {
    setSelectedDate(null);
  }

  const navigateDate = (amount) => {
      if (view === 'monthly') {
          setCurrentDate(addMonths(currentDate, amount));
      } else if (view === 'weekly') {
          setCurrentDate(addDays(currentDate, amount * 7));
      } else if (view === 'daily') {
          setCurrentDate(addDays(currentDate, amount));
      }
  };

  return (
    <div className="flex h-screen overflow-hidden dark:bg-gray-950 bg-gray-100 font-sans antialiased">
      <aside className={`w-1/4 min-w-[280px] p-6 m-4 rounded-3xl backdrop-blur-2xl bg-white bg-opacity-10 dark:bg-gray-800 dark:bg-opacity-10 text-black dark:text-white flex flex-col transition-colors duration-300 border border-gray-200 dark:border-gray-700 shadow-xl`}>
        <div className="flex items-center mb-6 space-x-2">
            <img
                src={user?.photoURL || "https://placehold.co/40x40/50c878/fff?text=U"}
                alt="User"
                className="rounded-full w-10 h-10 object-cover"
                onError={(e) => { e.target.src = "https://placehold.co/40x40/50c878/fff?text=U"; }} // Fallback on error
            />
            <h3 className="font-semibold text-sm truncate">
                Welcome, {user?.displayName || user?.email || 'User'}!
            </h3>
        </div>

        <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors"><ChevronLeft size={16} /></button>
                <span className="text-sm font-semibold">{format(currentDate, 'MMMM yyyy')}</span>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors"><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                    <span key={day} className="text-gray-400">{day}</span>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1 mt-2">
                {Array.from({ length: 42 }, (_, i) => {
                    const day = addDays(startOfWeek(startOfMonth(currentDate)), i);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isToday = isSameDay(day, today);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const dayColor = getDayColor(day);
                    const cellStyle = {};
                    if (dayColor) {
                        cellStyle.backgroundColor = dayColor;
                        cellStyle.color = '#fff';
                    }
                    return (
                        <div key={day.toString()}
                            className={`h-6 w-6 flex items-center justify-center rounded-full cursor-pointer transition-colors text-xs font-medium
                                ${!isCurrentMonth ? 'text-gray-600' : ''}
                                ${isToday ? 'bg-blue-500 text-white' : ''}
                                ${isSelected && !isToday ? 'bg-gray-700' : ''}
                                ${!dayColor && 'hover:bg-black hover:bg-opacity-10'}
                            `}
                            style={cellStyle}
                            onClick={() => {
                                setSelectedDate(day);
                                if (!isSameMonth(day, currentDate)) {
                                    setCurrentDate(day);
                                }
                            }}
                        >
                            {format(day, 'd')}
                        </div>
                    );
                })}
            </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">To Do List</h3>
              <ul className="space-y-2 text-sm">
                {todos.map((todo, index) => (
                  <li key={index} className="flex items-center justify-between space-x-2 p-2 rounded-lg bg-black bg-opacity-10">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" className="form-checkbox h-4 w-4 text-purple-600 rounded" onChange={() => handleCompleteTodo(index)} />
                      <span className="dark:text-white">{todo}</span>
                    </label>
                    <button onClick={() => handleRemoveTodo(index, false)} className="text-gray-400 hover:text-white transition-colors"><X size={16} /></button>
                  </li>
                ))}
                {todos.length < 5 && (
                  <li key={-1} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newTodo}
                      onChange={(e) => setNewTodo(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                      placeholder="Add a new to do..."
                      className="flex-1 p-2 rounded-lg bg-black bg-opacity-10 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button onClick={handleAddTodo} className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors">
                      <Plus size={16} />
                    </button>
                  </li>
                )}
              </ul>
            </div>
            {completedTodos.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold mb-2">Completed History</h3>
                    <ul className="space-y-2 text-sm">
                        {completedTodos.map((todo, index) => (
                          <li key={index} className="flex items-center justify-between space-x-2 p-2 rounded-lg bg-green-500 bg-opacity-10 text-gray-400 line-through">
                              <span className="flex items-center space-x-2">
                                  <Check size={16} className="text-green-500"/>
                                  <span>{todo}</span>
                              </span>
                              <button onClick={() => handleRemoveTodo(index, true)} className="text-gray-400 hover:text-white transition-colors"><X size={16} /></button>
                          </li>
                        ))}
                    </ul>
                </div>
            )}
            <div>
              <h3 className="text-sm font-semibold mb-2">Categories</h3>
              <ul className="space-y-2 text-sm">
                {categories.map(cat => (
                  <li
                    key={cat}
                    className={`flex items-center justify-between space-x-2 p-2 rounded-lg cursor-pointer transition-colors duration-200
                      ${selectedCategoryFilter === cat ? 'bg-blue-500 bg-opacity-50' : 'hover:bg-black hover:bg-opacity-10'}
                    `}
                    onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === cat ? null : cat)}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${categoryColors[cat] || 'bg-gray-500'}`}></div>
                      <span className="dark:text-white">{cat}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleRemoveCategory(cat); }} className="text-gray-400 hover:text-white transition-colors"><X size={16} /></button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center space-x-2 mt-4">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    placeholder="New category..."
                    className="flex-1 p-2 rounded-lg bg-black bg-opacity-10 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button onClick={handleAddCategory} className="py-2 px-4 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors text-white text-xs">
                    Add
                  </button>
              </div>
            </div>
        </div>
        <div className="flex-shrink-0 flex items-center justify-between mt-6">
            <button
                onClick={() => { setIsModalOpen(true); setSelectedTask(null); setSelectedDate(today); }}
                className="w-10 h-10 flex items-center justify-center bg-blue-500 rounded-full shadow-lg transition-all duration-200 transform hover:scale-110"
                title="Add New Task"
            >
                <Plus size={24} />
            </button>
            <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-full hover:bg-white hover:bg-opacity-10 transition-colors"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
                {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
            {/* Sign In/Out Buttons */}
            {user && !user.isAnonymous ? (
                <button
                    onClick={handleSignOut}
                    className="p-2 rounded-full text-white hover:bg-white hover:bg-opacity-10 transition-colors"
                    title="Sign Out"
                >
                    <LogOut size={24} />
                </button>
            ) : (
                <button
                    onClick={handleGoogleSignIn}
                    className="p-2 rounded-full text-white hover:bg-white hover:bg-opacity-10 transition-colors"
                    title="Sign In with Google"
                >
                    <LogIn size={24} />
                </button>
            )}
        </div>
        <div className="mt-8 text-center text-sm text-gray-400">
            Developed by: <a href="https://www.linkedin.com/in/parvej-iu/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Md Parvej Hossain </a>
        </div>
      </aside>
      <main className="flex-1 flex flex-col p-6 m-4 rounded-3xl backdrop-blur-2xl bg-white bg-opacity-10 dark:bg-gray-800 dark:bg-opacity-10 text-gray-900 dark:text-gray-100 transition-colors duration-300 border border-gray-200 dark:border-gray-700 shadow-xl">
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <h2 className="text-3xl font-bold">
                {view === 'monthly' && format(currentDate, "MMMM yyyy")}
                {view === 'weekly' && `${format(startOfWeek(currentDate), "MMM d")} - ${format(endOfWeek(currentDate), "MMM d, yyyy")}`}
                {view === 'daily' && format(currentDate, "EEEE, MMMM d, yyyy")}
            </h2>
            <button onClick={() => setCurrentDate(new Date())} className="py-1 px-3 text-sm rounded-full bg-gray-50 bg-opacity-50 dark:bg-gray-700 dark:bg-opacity-50 backdrop-blur-md hover:bg-opacity-70 dark:text-white">Today</button>
            <button onClick={() => navigateDate(-1)} className="p-1 rounded-full bg-gray-50 bg-opacity-50 dark:bg-gray-700 dark:bg-opacity-50 backdrop-blur-md hover:bg-opacity-70"><ChevronLeft size={20} /></button>
            <button onClick={() => navigateDate(1)} className="p-1 rounded-full bg-gray-50 bg-opacity-50 dark:bg-gray-700 dark:bg-opacity-50 backdrop-blur-md hover:bg-opacity-70"><ChevronRight size={20} /></button>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setView('monthly')}
              className={`py-2 px-4 rounded-full font-semibold transition-colors backdrop-blur-md
                ${view === 'monthly' ? 'bg-blue-500 text-white' : 'bg-white bg-opacity-50 dark:bg-gray-700 dark:bg-opacity-50 dark:text-gray-300'}`
              }
            >
              Month
            </button>
            <button
              onClick={() => setView('weekly')}
              className={`py-2 px-4 rounded-full font-semibold transition-colors backdrop-blur-md
                ${view === 'weekly' ? 'bg-blue-500 text-white' : 'bg-white bg-opacity-50 dark:bg-gray-700 dark:bg-opacity-50 dark:text-gray-300'}`
              }
            >
              Week
            </button>
            <button
              onClick={() => setView('daily')}
              className={`py-2 px-4 rounded-full font-semibold transition-colors backdrop-blur-md
                ${view === 'daily' ? 'bg-blue-500 text-white' : 'bg-white bg-opacity-50 dark:bg-gray-700 dark:bg-opacity-50 dark:text-gray-300'}`
              }
            >
              Day
            </button>
          </div>
          <button onClick={clearSelection} className="py-1 px-3 text-sm rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors">Clear Selection</button>
        </div>
        <div className="flex-1 overflow-hidden">
          {renderView()}
        </div>
        <TaskModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          task={selectedTask}
          date={selectedDate}
          onSubmit={handleTaskSubmit}
          onDelete={handleTaskDelete}
          categories={categories}
          onMarkCompleted={handleMarkCompleted}
        />
        <ConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            onConfirm={confirmRemoveCategory}
            message={`Are you sure you want to delete the category "${categoryToDelete}"? This action cannot be undone.`}
        />
        <TaskDetailsModal
            isOpen={isTaskDetailsModalOpen}
            onClose={() => setIsTaskDetailsModalOpen(false)}
            tasksForDay={tasksForSelectedDay}
            onMarkCompleted={handleMarkCompleted}
            onEdit={(task) => {
                setIsTaskDetailsModalOpen(false);
                setSelectedTask(task);
                setIsModalOpen(true);
            }}
            onDelete={handleTaskDelete}
        />
      </main>
      {showNotification && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-800 text-white rounded-lg shadow-lg z-50">
          {notificationMessage}
        </div>
      )}
    </div>
  );
};