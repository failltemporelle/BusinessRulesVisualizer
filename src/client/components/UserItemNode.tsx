import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import type { UserItem } from '../services/UserService.js'
import { IconFileCode, IconTicket, IconSettings, IconClock } from '@tabler/icons-react'

export type UserItemNodeData = UserItem & {
    /** Whether this is a created item or an assigned task */
    type: 'assigned' | 'created'
    /** True when this item's detail panel is currently open (unused for now but good for consistency) */
    isDetailOpen?: boolean
}

/**
 * Individual User Item card rendered inside a GroupNode container.
 * Displays title (name or short_description), sys_class_name badge, and item type.
 */
export default function UserItemNode({ data }: NodeProps<UserItemNodeData>) {
    const isAssigned = data.type === 'assigned'
    
    // Pick an icon based on table name (sys_class_name) or type
    let ItemIcon = IconFileCode
    if (isAssigned) {
        ItemIcon = IconTicket
    } else if (data.sys_class_name.includes('ui_') || data.sys_class_name.includes('form')) {
        ItemIcon = IconSettings
    }

    const title = isAssigned ? data.short_description || data.number : data.name
    const secondaryText = isAssigned ? data.number : `Created: ${data.created_on?.split(' ')[0]}`

    return (
        <div className={`br-node${data.isDetailOpen ? ' br-node--open' : ''}`} style={{ borderColor: isAssigned ? '#22c55e' : '#3b82f6' }}>
            {/* Left handle for Assigned items, Right handle for Created items?
                Actually, the layout might just flow top to bottom like Before/After. 
                We will use standard top/bottom handles for vertical layout or side for horizontal. */}
            <Handle type="target" position={Position.Top} className="br-node__handle" />

            <div className="br-node__header" style={{ flexWrap: 'nowrap' }}>
                <ItemIcon size={16} color={isAssigned ? '#15803d' : '#1d4ed8'} style={{ flexShrink: 0 }} />
                <span className="br-node__badge" style={{ 
                    backgroundColor: isAssigned ? '#dcfce7' : '#dbeafe', 
                    color: isAssigned ? '#166534' : '#1e40af',
                    border: 'none'
                }}>
                    {data.class_display}
                </span>
                
                {data.state && (
                    <span className="br-node__badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                        {data.state}
                    </span>
                )}
            </div>

            <div className="br-node__name" title={title || '(empty)'} style={{ marginTop: '8px' }}>
                {title || '(empty)'}
            </div>

            <div className="br-node__ops">{secondaryText}</div>

            <Handle type="source" position={Position.Bottom} className="br-node__handle" />
        </div>
    )
}
