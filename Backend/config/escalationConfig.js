export const ESCALATION_RECIPIENTS = (level, a) => {
  switch (level) {
    case 0:
      return { to: [a.employee_email], cc: [] };

    case 1:
      return { to: [a.employee_email], cc: [] };

    case 2:
      return {
        to: [a.employee_email],
        cc: [a.manager_email],
      };

    case 3:
      return {
        to: [a.employee_email],
        cc: [process.env.PLANT_HEAD_EMAIL, a.manager_email],
      };
  }
};
