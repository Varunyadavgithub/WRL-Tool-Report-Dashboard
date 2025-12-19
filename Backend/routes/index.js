import { Router } from "express";
import authRoutes from "./auth.route.js";
import commonRoutes from "./common.route.js";
import visitorRoutes from "./visitor.route.js";
import qualityRoutes from "./quality.route.js";
import productionRoutes from "./production.route.js";
import dispatchRoute from "./dispatch.route.js";
import productionPlaningRoutes from "./planing.route.js";

const routers = Router();

routers.use("/auth", authRoutes);
routers.use("/shared", commonRoutes);
routers.use("/prod", productionRoutes);
routers.use("/quality", qualityRoutes);
routers.use("/dispatch", dispatchRoute);
routers.use("/planing", productionPlaningRoutes);
routers.use("/visitor", visitorRoutes);

export default routers;
