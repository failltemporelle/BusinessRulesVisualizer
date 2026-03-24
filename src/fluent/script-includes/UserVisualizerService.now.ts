import '@servicenow/sdk/global'
import { ScriptInclude } from '@servicenow/sdk/core'

export const userVisualizerService = ScriptInclude({
    $id: Now.ID['si.user_visualizer_service'],
    name: 'UserVisualizerService',
    apiName: 'x_1118332_brv.UserVisualizerService',
    script: Now.include('./UserVisualizerService.server.js'),
    description: 'Provides GlideAjax methods for querying user items (created/assigned) and managing user preferences for the Business Rules Visualizer.',
    callerAccess: 'tracking',
    clientCallable: true,
    mobileCallable: true,
    sandboxCallable: true,
    accessibleFrom: 'public',
    active: true,
})
