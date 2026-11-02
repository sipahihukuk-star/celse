// Oturumdaki kişi sunucuda yönetici mi? Yönetici her şeyi kilitsiz görür (test için).
import { useEffect, useState } from "react";
import { resetAdminCache, serverAdmin } from "../admin/store";
import { onAccountChange } from "./account";

export function useServerAdmin() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const check = () => { resetAdminCache(); serverAdmin().then(setOn); };
    check();
    return onAccountChange(check);
  }, []);
  return on;
}
