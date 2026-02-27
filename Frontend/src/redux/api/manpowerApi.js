import { baseURL } from "../../assets/assets";
import axios from "axios";

export const createManpower = (data) =>
  axios.post(`${baseURL}manpower/create`, data);

export const getManpowerList = () =>
  axios.get(`${baseURL}manpower/list`);

export const approveManpower = (data) =>
  axios.post(`${baseURL}manpower/approve`, data);

export const getSecurityList = () =>
  axios.get(`${baseURL}manpower/security-list`);