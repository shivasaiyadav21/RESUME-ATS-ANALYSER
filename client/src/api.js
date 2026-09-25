import axios from "axios";

const API = axios.create({
  baseURL: "https://resume-ats-backend-40qm.onrender.com"
});

export default API;