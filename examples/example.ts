import AsyncSource from '../src/index';

// Define types for API responses and errors
interface User {
    id: number;
    name: string;
    email: string;
}

interface ApiError {
    code: string;
    message: string;
    details?: any;
}

// Example 1: Basic typed usage
const fetchUsers = async (): Promise<Array<User>> => {
    const response = await fetch('/api/users');
    if (!response.ok) {
        throw { code: 'FETCH_ERROR', message: 'Failed to fetch users' };
    }
    return response.json();
};

const usersSource = new AsyncSource(fetchUsers);

// Example 2: With custom error handler and typed error
const handleApiError = (error: ApiError) => {
    console.error(`API Error [${error.code}]: ${error.message}`);
};

// Example 3: Service method with parameters
const fetchUserById = async (type: string, id: number): Promise<User> => {
    const response = await fetch(`/api/users/${type}/${id}`);
    if (!response.ok) {
        throw { code: 'USER_NOT_FOUND', message: `User with id ${id} not found` };
    }
    return response.json();
};

const userSource = new AsyncSource(fetchUserById, handleApiError);

// Usage examples
async function examples() {
    // Load all users
    await usersSource.update();
    console.log('Users:', usersSource.data); // Type: Array<User> | null
    console.log('Loading:', usersSource.isLoading); // Type: boolean
    
    // Load specific user
    await userSource.update('name', 121);
    if (userSource.data) {
        console.log('User:', userSource.data.name); // Type: User | null
    }

    // Use push method with success handler
    await userSource.push((user: User) => {
        console.log(`Loaded user: ${user.name}`);
    }, 'admin', 121);
    
    // Load only if empty
    await usersSource.updateIfEmpty();
    
    // Clear data
    usersSource.clear();
    console.log('Data after clear:', usersSource.data); // null
}

export { examples, User, ApiError };