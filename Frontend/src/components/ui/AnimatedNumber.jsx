import { useSpring, animated } from "@react-spring/web";
import { useEffect, useState } from "react";

const AnimatedNumber = ({ value, suffix = "" }) => {
  const isValid = value !== null && value !== undefined && !isNaN(value);

  const [display, setDisplay] = useState(isValid ? value : null);

  const [styles, api] = useSpring(() => ({
    number: isValid ? value : 0,
    config: { tension: 120, friction: 20 }
  }));

  useEffect(() => {
    if (!isValid) {
      setDisplay(null);
      return;
    }

    setDisplay(value);
    api.start({ number: value });

  }, [value]);

  // If no real data → show blank instead of 0
  if (display === null) return <span>--</span>;

  return (
    <animated.span>
      {styles.number.to((n) => `${n.toFixed(1)}${suffix}`)}
    </animated.span>
  );
};

export default AnimatedNumber;
