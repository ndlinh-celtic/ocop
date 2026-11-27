import { defineModule } from "../shared/module";
import { listDeliveries } from "../platform/deliveries";
import { listNotifications, markAllRead, markRead, unreadCount } from "./inbox";

export const notificationsModule = defineModule({
  useCases: {
    list: listNotifications,
    unreadCount,
    markRead,
    markAllRead,
    listDeliveries,
  },
});
