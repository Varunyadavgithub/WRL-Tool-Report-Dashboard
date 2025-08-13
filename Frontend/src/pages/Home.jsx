import Title from "../components/common/Title";
import { useSelector } from "react-redux";

const Home = () => {
  const { user } = useSelector((store) => store.auth);
  return (
    <div className="flex items-center justify-center p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title
        title={`Welcome to the Dashboard, ${user.name}!`}
        subTitle="We're glad to have you back. Here you can track your progress, manage your tasks, and explore insights tailored just for you."
        align="center"
      />
    </div>
  );
};

export default Home;