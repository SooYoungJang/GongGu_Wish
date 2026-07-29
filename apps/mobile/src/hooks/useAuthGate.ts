import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import { useAudience } from "../audience/AudienceContext";
import type { RootStackParamList } from "../types";

export function useAuthGate() {
  const { user } = useAuth();
  const { policy } = useAudience();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const requireAuth = useCallback(() => {
    if (!policy.canAuthenticate) return false;
    if (user) return true;
    navigation.navigate("Login");
    return false;
  }, [navigation, policy.canAuthenticate, user]);

  return {
    canAuthenticate: policy.canAuthenticate,
    isAuthenticated: policy.canAuthenticate && Boolean(user),
    requireAuth,
  };
}
