import { useSettingsStore, useNotificationSettings } from '../../stores/settings';

export default function NotificationSettings() {
  const settings = useNotificationSettings();
  const { updateNotifications } = useSettingsStore();

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        updateNotifications({ browserNotifications: true });
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Basic Notifications */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Basic Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Run Completion</div>
              <div className="text-xs text-textDim">Notify when benchmark runs complete</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.runCompletion}
                onChange={(e) => updateNotifications({ runCompletion: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Error Alerts</div>
              <div className="text-xs text-textDim">Notify when errors occur</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.errorAlerts}
                onChange={(e) => updateNotifications({ errorAlerts: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Browser Notifications */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Browser Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Browser Notifications</div>
              <div className="text-xs text-textDim">Show system notifications</div>
            </div>
            <div className="flex items-center gap-2">
              {!('Notification' in window) ? (
                <span className="text-xs text-red-400">Not supported</span>
              ) : Notification.permission === 'denied' ? (
                <span className="text-xs text-red-400">Blocked</span>
              ) : Notification.permission === 'default' ? (
                <button
                  onClick={requestNotificationPermission}
                  className="px-2 py-1 text-xs rounded border border-[var(--border)] text-textDim hover:text-text"
                >
                  Enable
                </button>
              ) : (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.browserNotifications}
                    onChange={(e) => updateNotifications({ browserNotifications: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
                </label>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Test Notification */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Test</h3>
        <button
          onClick={() => {
            if (settings.browserNotifications && Notification.permission === 'granted') {
              new Notification('ModelForge', {
                body: 'This is a test notification!',
                icon: '/favicon.ico'
              });
            } else {
              alert('Test notification! (Browser notifications not enabled)');
            }
          }}
          className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-textDim hover:text-text hover:bg-[rgba(255,255,255,0.05)] transition-all duration-200"
        >
          Send Test Notification
        </button>
      </div>
    </div>
  );
}
