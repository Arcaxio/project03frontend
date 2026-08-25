const DB_NAME = 'maimaiDB'
const DB_VERSION = 1
const STORE_NAME = 'maimaiStore'
const DATA_KEY = 'maimaiChartsData'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}

export async function getMaimaiData(): Promise<any | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const getReq = store.get(DATA_KEY)

      getReq.onsuccess = () => {
        resolve(getReq.result ?? null)
      }

      getReq.onerror = () => {
        reject(getReq.error)
      }
    })
  } catch (err) {
    console.error('Error fetching data from IndexedDB:', err)
    return null
  }
}

export async function saveMaimaiData(data: any): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const putReq = store.put(data, DATA_KEY)

      putReq.onsuccess = () => {
        resolve()
      }

      putReq.onerror = () => {
        reject(putReq.error)
      }
    })
  } catch (err) {
    console.error('Error saving data to IndexedDB:', err)
  }
}
