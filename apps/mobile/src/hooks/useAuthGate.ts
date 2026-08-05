import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useAuth, type AuthContinuation } from "../context/AuthContext";
import { useAudience } from "../audience/AudienceContext";
import type { RootStackParamList } from "../types";

export function useAuthGate() {
  const { setAuthContinuation, user } = useAuth();
  const { policy } = useAudience();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const requireAuth = useCallback((onAuthenticated?: AuthContinuation) => {
    if (policy.canAuthenticate && user) return true;
    setAuthContinuation(onAuthenticated ?? null);
    navigation.navigate("Login");
    return false;
  }, [navigation, policy.canAuthenticate, setAuthContinuation, user]);

  return {
    canAuthenticate: policy.canAuthenticate,
    isAuthenticated: policy.canAuthenticate && Boolean(user),
    requireAuth,
  };
}
