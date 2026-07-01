import { useEffect } from "react";
import { useDispatch } from "react-redux";
import {
  useGetMaterialsQuery,
  useGetShiftsQuery,
  useGetDowntimeReasonsQuery,
  useGetDepartmentsQuery,
  useGetQualityDefectsQuery,
  useGetMailSubscribersQuery,
  useGetMachinesQuery,
  useGetPlansQuery,
  useGetCheckpointLibraryQuery,
} from "../redux/api/masterConfigApi.js";
import {
  setMaterials,
  setShifts,
  setDowntimeReasons,
  setDepartments,
  setQualityDefects,
  setMailSubscribers,
  setMachines,
  setPlans,
  setCheckpointLibrary,
} from "../redux/slices/masterConfigSlice.js";

/**
 * Keeps masterConfigSlice (the shared read cache used across the app via
 * selectMaterials/selectShifts/etc.) in sync with the Master Config tables
 * in the database. Mounted once at the app layout level.
 */
export const useSyncMasterConfig = () => {
  const dispatch = useDispatch();

  const { data: materials }       = useGetMaterialsQuery();
  const { data: shifts }          = useGetShiftsQuery();
  const { data: downtimeReasons } = useGetDowntimeReasonsQuery();
  const { data: departments }     = useGetDepartmentsQuery();
  const { data: qualityDefects }  = useGetQualityDefectsQuery();
  const { data: mailSubscribers } = useGetMailSubscribersQuery();
  const { data: machines }        = useGetMachinesQuery();
  const { data: plans }           = useGetPlansQuery();
  const { data: checkpointLibrary } = useGetCheckpointLibraryQuery();

  useEffect(() => { if (materials)       dispatch(setMaterials(materials)); },             [materials, dispatch]);
  useEffect(() => { if (shifts)          dispatch(setShifts(shifts)); },                   [shifts, dispatch]);
  useEffect(() => { if (downtimeReasons) dispatch(setDowntimeReasons(downtimeReasons)); }, [downtimeReasons, dispatch]);
  useEffect(() => { if (departments)     dispatch(setDepartments(departments)); },         [departments, dispatch]);
  useEffect(() => { if (qualityDefects)  dispatch(setQualityDefects(qualityDefects)); },   [qualityDefects, dispatch]);
  useEffect(() => { if (mailSubscribers) dispatch(setMailSubscribers(mailSubscribers)); }, [mailSubscribers, dispatch]);
  useEffect(() => { if (machines)        dispatch(setMachines(machines)); },               [machines, dispatch]);
  useEffect(() => { if (plans)           dispatch(setPlans(plans)); },                     [plans, dispatch]);
  useEffect(() => { if (checkpointLibrary) dispatch(setCheckpointLibrary(checkpointLibrary)); }, [checkpointLibrary, dispatch]);
};
