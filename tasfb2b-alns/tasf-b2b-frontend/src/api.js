import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080/api/planner',
});

export const runALNS = async (data) => {
  const response = await api.post('/execute', data);
  return response.data;
};
