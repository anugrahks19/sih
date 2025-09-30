import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useMemo,
  useState,
} from "react";

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  language: string;
  consent: boolean;
  accessToken?: string;
}

interface UserSessionContextValue {
  user: UserProfile | null;
  setUser: Dispatch<SetStateAction<UserProfile | null>>;
  assessmentId: string | null;
  setAssessmentId: Dispatch<SetStateAction<string | null>>;
  clearSession: () => void;
}

const UserSessionContext = createContext<UserSessionContextValue | undefined>(
  undefined,
);

export const UserSessionProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);

  const clearSession = () => {
    setUser(null);
    setAssessmentId(null);
  };

  const value = useMemo(
    () => ({
      user,
      setUser,
      assessmentId,
      setAssessmentId,
      clearSession,
    }),
    [user, assessmentId],
  );

  return (
    <UserSessionContext.Provider value={value}>
      {children}
    </UserSessionContext.Provider>
  );
};

export const useUserSession = () => {
  const context = useContext(UserSessionContext);
  if (!context) {
    throw new Error("useUserSession must be used within a UserSessionProvider");
  }
  return context;
};
