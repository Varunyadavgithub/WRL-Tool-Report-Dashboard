import Title from "../components/ui/Title";
import { useSelector } from "react-redux";

const Home = () => {
  const { user } = useSelector((store) => store.auth);
  return (
    <div className="flex items-center justify-center p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title
        title={`Welcome to the Dashboard, ${user.name}!`}
        subTitle="A centralized industrial platform providing secure, role-based access to manufacturing operations, reports, workflows, and real-time insights."
        align="center"
      />
    </div>
  );
};

export default Home;
