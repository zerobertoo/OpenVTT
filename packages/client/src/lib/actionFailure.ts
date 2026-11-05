import { toast } from "../components/ui/toast";
import { i18n } from "../i18n";
import { errorKey } from "../ui";

// For actions started from the map or the keyboard, which have no form to show the error in.
export function toastActionFailure(error: unknown) {
  toast({ title: i18n.t(errorKey(error)), tone: "error" });
}
