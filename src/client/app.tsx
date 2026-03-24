import React, { useState, useCallback, useEffect, useRef } from 'react'
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    type Node,
    type Edge,
    type NodeTypes,
    useNodesState,
    useEdgesState,
    MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import './app.css'

import { AppShell, Center, Text, ThemeIcon, Stack, SegmentedControl, Group, Box } from '@mantine/core'
import { IconSettings, IconUser } from '@tabler/icons-react'

import TableSelector from './components/TableSelector.js'
import UserSelector from './components/UserSelector.js'
import GroupNode, { type GroupNodeData } from './components/GroupNode.js'
import BusinessRuleNode from './components/BusinessRuleNode.js'
import DatabaseNode, { type DatabaseNodeData } from './components/DatabaseNode.js'
import FormNode, { type FormNodeData } from './components/FormNode.js'
import SectionLabelNode, { type SectionLabelNodeData } from './components/SectionLabelNode.js'
import DetailPanel from './components/DetailPanel.js'
import UserItemNode from './components/UserItemNode.js'

import {
    type BusinessRule,
    getBusinessRulesForTable,
    getRecentTables,
    saveTablePreference,
    deleteTablePreference,
} from './services/BusinessRuleService.js'

import {
    type UserSuggestion,
    type UserItemsPayload,
    type UserItem,
    getUserItems,
    getRecentUsers,
    saveUserPreference,
    deleteUserPreference
} from './services/UserService.js'

// ── Layout constants ───────────────────────────────────────────────────────────

const NODE_WIDTH        = 220
const NODE_HEIGHT       = 120
const NODE_GAP          = 20
const GROUP_HEADER      = 70
const GROUP_PADDING_X   = 20
const GROUP_WIDTH       = NODE_WIDTH + GROUP_PADDING_X * 2
const SECTION_LABEL_H   = 36   // height of each section label node
const ROW_GAP           = 60   // vertical gap between the two pipeline rows
const SECTION_LABEL_W   = 1250 // spans from COLUMN_X.before(50) to end of async(1040+260)

const COLUMN_X = { before: 50, db: 390, after: 630, async: 1040 }
const DB_WIDTH  = 160
const DB_HEIGHT = 160
const COLLAPSED_H = 52   // Group height when folded to header only

// ── Custom node types ──────────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
    groupNode:        GroupNode,
    businessRuleNode: BusinessRuleNode,
    databaseNode:     DatabaseNode,
    formNode:         FormNode,
    sectionLabelNode: SectionLabelNode,
    userItemNode:     UserItemNode,
}

// ── Flow builder (Table) ───────────────────────────────────────────────────────

function buildFlowElements(
    tableName: string,
    rules: BusinessRule[],
    collapsedGroups: ReadonlySet<string>,
    onToggleGroup: (groupId: string) => void,
    selectedRuleId: string | null = null
): { nodes: Node[]; edges: Edge[] } {
    const before  = rules.filter(r => r.when === 'before').sort((a, b) => a.order - b.order)
    const after   = rules.filter(r => r.when === 'after').sort((a, b) => a.order - b.order)
    const async_  = rules.filter(r => r.when === 'async').sort((a, b) => a.order - b.order)
    const display = rules.filter(r => r.when === 'before_display').sort((a, b) => a.order - b.order)

    const groupHeight = (count: number) =>
        Math.max(140, GROUP_HEADER + count * (NODE_HEIGHT + NODE_GAP) + 20)

    const effectiveH = (groupId: string, count: number) =>
        collapsedGroups.has(groupId) ? COLLAPSED_H : groupHeight(count)

    const groupNodes: Node[] = []
    const ruleNodes:  Node[] = []
    const edges:      Edge[] = []

    function addSectionLabel(id: string, label: string, sublabel: string, y: number, width = SECTION_LABEL_W) {
        groupNodes.push({
            id,
            type:       'sectionLabelNode',
            position:   { x: COLUMN_X.before, y },
            style:      { width, height: SECTION_LABEL_H },
            data:       { label, sublabel } satisfies SectionLabelNodeData,
            selectable: false,
            draggable:  false,
            connectable: false,
        })
    }

    function addPhase(
        phaseRules: BusinessRule[],
        groupId: string,
        phase: 'before' | 'after' | 'async' | 'display',
        label: string,
        colX: number,
        rowY: number
    ) {
        const isCollapsed = collapsedGroups.has(groupId)
        const h = isCollapsed ? COLLAPSED_H : groupHeight(phaseRules.length)

        groupNodes.push({
            id:       groupId,
            type:     'groupNode',
            position: { x: colX, y: rowY },
            style:    { width: GROUP_WIDTH, height: h },
            data:     {
                label,
                phase,
                ruleCount:  phaseRules.length,
                collapsed:  isCollapsed,
                onToggle:   () => onToggleGroup(groupId),
            } satisfies GroupNodeData,
            draggable:  false,
        })

        if (isCollapsed) return

        phaseRules.forEach((rule, idx) => {
            const nodeId = `br-${rule.sys_id}`
            ruleNodes.push({
                id:       nodeId,
                type:     'businessRuleNode',
                parentId: groupId,
                extent:   'parent',
                position: {
                    x: GROUP_PADDING_X,
                    y: GROUP_HEADER + idx * (NODE_HEIGHT + NODE_GAP),
                },
                style:    { width: NODE_WIDTH, height: NODE_HEIGHT },
                data:     { ...rule, isDetailOpen: rule.sys_id === selectedRuleId, isSearchMatch: (rule as any).isSearchMatch },
                draggable: false,
            })

            if (idx < phaseRules.length - 1) {
                const nextId = `br-${phaseRules[idx + 1].sys_id}`
                edges.push({
                    id:        `seq-${nodeId}-${nextId}`,
                    source:    nodeId,
                    target:    nextId,
                    type:      'smoothstep',
                    markerEnd: { type: MarkerType.ArrowClosed },
                    style:     { stroke: '#94a3b8' },
                })
            }
        })
    }

    let currentY = 0

    if (display.length > 0) {
        addSectionLabel('label-display', 'Form Load Pipeline',
            'database read → display rules → form render',
            currentY, SECTION_LABEL_W)
            
        const displayRowY = currentY + SECTION_LABEL_H + 44
        
        ruleNodes.push({
            id:       'db-node-display',
            type:     'databaseNode',
            position: { x: COLUMN_X.before, y: displayRowY },
            style:    { width: DB_WIDTH, height: DB_HEIGHT },
            data:     { tableName, label: 'Database Read' } satisfies DatabaseNodeData,
            draggable: false,
        })
        
        addPhase(display, 'group-display', 'display', 'Display', COLUMN_X.db, displayRowY)
        
        ruleNodes.push({
            id:       'form-node',
            type:     'formNode',
            position: { x: COLUMN_X.after + 150, y: displayRowY },
            style:    { width: DB_WIDTH, height: DB_HEIGHT },
            data:     {} satisfies FormNodeData,
            draggable: false,
        })
        
        const isDisplayCollapsed = collapsedGroups.has('group-display')
        const firstDisplayId = (!isDisplayCollapsed && display.length > 0)
            ? `br-${display[0].sys_id}`
            : null
        edges.push({
            id:       'edge-db-display',
            source:   'db-node-display',
            target:   firstDisplayId ?? 'group-display',
            ...(firstDisplayId ? {} : { targetHandle: 'group-target' }),
            type:     'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
            style:    { stroke: '#a855f7', strokeWidth: 2 },
        })
        
        const lastDisplayId = (!isDisplayCollapsed && display.length > 0)
            ? `br-${display[display.length - 1].sys_id}`
            : null
        edges.push({
            id:       'edge-display-form',
            source:   lastDisplayId ?? 'group-display',
            ...(lastDisplayId ? {} : { sourceHandle: 'group-source' }),
            target:   'form-node',
            type:     'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
            style:    { stroke: '#a855f7', strokeWidth: 2 },
        })
        
        const displayGroupH = effectiveH('group-display', display.length)
        const topRowH = Math.max(displayGroupH, DB_HEIGHT)
        currentY = displayRowY + topRowH + ROW_GAP
    }

    addSectionLabel('label-write', 'Record Write Pipeline',
        'before → database operation → after  ·  async (fire & forget)', currentY)

    const writeRowY = currentY + SECTION_LABEL_H + 44

    addPhase(before, 'group-before', 'before', 'Before', COLUMN_X.before, writeRowY)
    addPhase(after,  'group-after',  'after',  'After',  COLUMN_X.after,  writeRowY)
    if (async_.length > 0) {
        addPhase(async_, 'group-async', 'async', 'Async', COLUMN_X.async, writeRowY)
    }

    ruleNodes.push({
        id:       'db-node',
        type:     'databaseNode',
        position: { x: COLUMN_X.db, y: writeRowY },
        style:    { width: DB_WIDTH, height: DB_HEIGHT },
        data:     { tableName } satisfies DatabaseNodeData,
        draggable: false,
    })

    const isBeforeCollapsed = collapsedGroups.has('group-before')
    const lastBeforeId = (!isBeforeCollapsed && before.length > 0)
        ? `br-${before[before.length - 1].sys_id}`
        : null
    edges.push({
        id:       'edge-before-db',
        source:   lastBeforeId ?? 'group-before',
        ...(lastBeforeId ? {} : { sourceHandle: 'group-source' }),
        target:   'db-node',
        type:     'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style:    { stroke: '#3b82f6', strokeWidth: 2 },
    })

    const isAfterCollapsed = collapsedGroups.has('group-after')
    const firstAfterId = (!isAfterCollapsed && after.length > 0)
        ? `br-${after[0].sys_id}`
        : null
    edges.push({
        id:       'edge-db-after',
        source:   'db-node',
        target:   firstAfterId ?? 'group-after',
        ...(firstAfterId ? {} : { targetHandle: 'group-target' }),
        type:     'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style:    { stroke: '#22c55e', strokeWidth: 2 },
    })

    return { nodes: [...groupNodes, ...ruleNodes], edges }
}

// ── Flow builder (User) ───────────────────────────────────────────────────────

function buildUserFlowElements(
    user: UserSuggestion,
    items: UserItemsPayload,
    collapsedGroups: ReadonlySet<string>,
    onToggleGroup: (groupId: string) => void,
): { nodes: Node[]; edges: Edge[] } {
    const createdItems = items.created || []
    const assignedItems = items.assigned || []
    
    // Group sizes
    const groupHeight = (count: number) => Math.max(140, GROUP_HEADER + count * (NODE_HEIGHT + NODE_GAP) + 20)
    
    const isCreatedCollapsed = collapsedGroups.has('group-user-created')
    const isAssignedCollapsed = collapsedGroups.has('group-user-assigned')

    const createdH = isCreatedCollapsed ? COLLAPSED_H : groupHeight(createdItems.length)
    const assignedH = isAssignedCollapsed ? COLLAPSED_H : groupHeight(assignedItems.length)

    const groupNodes: Node[] = []
    const itemNodes:  Node[] = []
    const edges:      Edge[] = []

    const startY = 50

    // Database Node for the User in the center
    itemNodes.push({
        id:       'user-db-node',
        type:     'databaseNode',
        position: { x: COLUMN_X.db, y: startY + 50 },
        style:    { width: DB_WIDTH, height: DB_HEIGHT },
        data:     { tableName: user.label, label: 'User' } satisfies DatabaseNodeData,
        draggable: false,
    })

    // Created Group (Left)
    groupNodes.push({
        id:       'group-user-created',
        type:     'groupNode',
        position: { x: COLUMN_X.before, y: startY },
        style:    { width: GROUP_WIDTH, height: createdH },
        data:     {
            label: 'Created by User',
            phase: 'before',
            ruleCount: createdItems.length,
            collapsed: isCreatedCollapsed,
            onToggle: () => onToggleGroup('group-user-created'),
        } satisfies GroupNodeData,
        draggable: false,
    })

    // Assigned Group (Right)
    groupNodes.push({
        id:       'group-user-assigned',
        type:     'groupNode',
        position: { x: COLUMN_X.after, y: startY },
        style:    { width: GROUP_WIDTH, height: assignedH },
        data:     {
            label: 'Assigned to User',
            phase: 'after',
            ruleCount: assignedItems.length,
            collapsed: isAssignedCollapsed,
            onToggle: () => onToggleGroup('group-user-assigned'),
        } satisfies GroupNodeData,
        draggable: false,
    })

    if (!isCreatedCollapsed) {
        createdItems.forEach((item, idx) => {
            const nodeId = `created-${item.sys_id}`
            itemNodes.push({
                id:       nodeId,
                type:     'userItemNode',
                parentId: 'group-user-created',
                extent:   'parent',
                position: { x: GROUP_PADDING_X, y: GROUP_HEADER + idx * (NODE_HEIGHT + NODE_GAP) },
                style:    { width: NODE_WIDTH, height: NODE_HEIGHT },
                data:     { ...item, type: 'created' },
                draggable: false,
            })
            if (idx < createdItems.length - 1) {
                edges.push({
                    id: `seq-${nodeId}-created-${createdItems[idx+1].sys_id}`,
                    source: nodeId,
                    target: `created-${createdItems[idx+1].sys_id}`,
                    type: 'smoothstep',
                    markerEnd: { type: MarkerType.ArrowClosed },
                    style: { stroke: '#94a3b8' },
                })
            }
        })
    }

    if (!isAssignedCollapsed) {
        assignedItems.forEach((item, idx) => {
            const nodeId = `assigned-${item.sys_id}`
            itemNodes.push({
                id:       nodeId,
                type:     'userItemNode',
                parentId: 'group-user-assigned',
                extent:   'parent',
                position: { x: GROUP_PADDING_X, y: GROUP_HEADER + idx * (NODE_HEIGHT + NODE_GAP) },
                style:    { width: NODE_WIDTH, height: NODE_HEIGHT },
                data:     { ...item, type: 'assigned' },
                draggable: false,
            })
            if (idx < assignedItems.length - 1) {
                edges.push({
                    id: `seq-${nodeId}-assigned-${assignedItems[idx+1].sys_id}`,
                    source: nodeId,
                    target: `assigned-${assignedItems[idx+1].sys_id}`,
                    type: 'smoothstep',
                    markerEnd: { type: MarkerType.ArrowClosed },
                    style: { stroke: '#94a3b8' },
                })
            }
        })
    }

    // Connect User to Groups computationally
    edges.push({
        id: 'edge-user-created',
        source: 'user-db-node',
        target: 'group-user-created',
        targetHandle: 'group-target',
        type: 'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#3b82f6', strokeWidth: 2 },
    })

    edges.push({
        id: 'edge-user-assigned',
        source: 'user-db-node',
        target: 'group-user-assigned',
        targetHandle: 'group-target',
        type: 'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#22c55e', strokeWidth: 2 },
    })

    return { nodes: [...groupNodes, ...itemNodes], edges }
}

// ── App component ──────────────────────────────────────────────────────────────

export default function App() {
    const [viewMode, setViewMode] = useState<'table' | 'user'>('table')

    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    
    // Shared states
    const [loading, setLoading]         = useState(false)
    const [error, setError]             = useState<string | null>(null)
    
    // Table states
    const [recentTables, setRecentTables] = useState<string[]>([])
    const [selectedRule, setSelectedRule] = useState<BusinessRule | null>(null)
    const [hideInherited, setHideInherited] = useState(false)
    const [hideActive, setHideActive]     = useState(false)
    const [hideInactive, setHideInactive] = useState(false)
    const [scriptSearchQuery, setScriptSearchQuery] = useState('')
    const currentTableRef = useRef<{ name: string; rules: BusinessRule[] } | null>(null)
    const [collapsedGroupsTable, setCollapsedGroupsTable] = useState<ReadonlySet<string>>(new Set())

    // User states
    const [recentUsers, setRecentUsers] = useState<UserSuggestion[]>([])
    const currentUserRef = useRef<{ user: UserSuggestion; items: UserItemsPayload } | null>(null)
    const [collapsedGroupsUser, setCollapsedGroupsUser] = useState<ReadonlySet<string>>(new Set())

    // Switch view modes
    useEffect(() => {
        // Clear flow when switching mode
        setNodes([])
        setEdges([])
        if (viewMode === 'table' && currentTableRef.current) {
            handleVisualizeTable(currentTableRef.current.name, false)
        } else if (viewMode === 'user' && currentUserRef.current) {
            handleVisualizeUser(currentUserRef.current.user, false)
        }
    }, [viewMode])

    // Load Recents
    useEffect(() => {
        getRecentTables().then(setRecentTables).catch(() => {})
        getRecentUsers().then(setRecentUsers).catch(() => {})
    }, [])

    // Delete Recents
    const handleDeleteRecentTable = useCallback((tableName: string) => {
        setRecentTables(prev => prev.filter(t => t !== tableName))
        deleteTablePreference(tableName).catch(() => {})
    }, [])
    
    const handleDeleteRecentUser = useCallback((userId: string) => {
        setRecentUsers(prev => prev.filter(u => u.value !== userId))
        deleteUserPreference(userId).catch(() => {})
    }, [])

    // Table Mode Toggles
    const handleToggleHideInherited = useCallback(() => setHideInherited(p => !p), [])
    const handleToggleHideActive = useCallback(() => setHideActive(p => !p), [])
    const handleToggleHideInactive = useCallback(() => setHideInactive(p => !p), [])
    const handleToggleGroupTable = useCallback((groupId: string) => {
        setCollapsedGroupsTable(prev => {
            const next = new Set(prev)
            if (next.has(groupId)) next.delete(groupId)
            else next.add(groupId)
            return next
        })
    }, [])

    // User Mode Toggles
    const handleToggleGroupUser = useCallback((groupId: string) => {
        setCollapsedGroupsUser(prev => {
            const next = new Set(prev)
            if (next.has(groupId)) next.delete(groupId)
            else next.add(groupId)
            return next
        })
    }, [])

    const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        if (node.type === 'businessRuleNode') setSelectedRule(node.data as BusinessRule)
    }, [])
    const handlePanelClose = useCallback(() => setSelectedRule(null), [])

    // Rebuild Table Flow
    useEffect(() => {
        if (viewMode !== 'table' || !currentTableRef.current) return
        const { name, rules } = currentTableRef.current
        let filteredRules = hideInherited ? rules.filter(r => r.inherited_from == null) : rules
        if (hideActive)   filteredRules = filteredRules.filter(r => r.active !== true)
        if (hideInactive) filteredRules = filteredRules.filter(r => r.active !== false)
        if (scriptSearchQuery.trim()) {
            const query = scriptSearchQuery.toLowerCase()
            filteredRules = filteredRules.filter(r => {
                const matches = (r.script && r.script.toLowerCase().includes(query)) ||
                                (r.name && r.name.toLowerCase().includes(query))
                ;(r as any).isSearchMatch = matches
                return matches
            })
        } else {
            filteredRules.forEach(r => (r as any).isSearchMatch = false)
        }
        const { nodes: n, edges: e } = buildFlowElements(
            name, filteredRules, collapsedGroupsTable, handleToggleGroupTable, selectedRule?.sys_id ?? null
        )
        setNodes(n)
        setEdges(e)
    }, [collapsedGroupsTable, handleToggleGroupTable, selectedRule, hideInherited, hideActive, hideInactive, scriptSearchQuery, setNodes, setEdges, viewMode])

    // Rebuild User Flow
    useEffect(() => {
        if (viewMode !== 'user' || !currentUserRef.current) return
        const { user, items } = currentUserRef.current
        const { nodes: n, edges: e } = buildUserFlowElements(
            user, items, collapsedGroupsUser, handleToggleGroupUser
        )
        setNodes(n)
        setEdges(e)
    }, [collapsedGroupsUser, handleToggleGroupUser, setNodes, setEdges, viewMode])

    // Visualize Actions
    const handleVisualizeTable = useCallback(async (tableName: string, fetchNew = true) => {
        if (fetchNew) {
            setLoading(true)
            setError(null)
            setNodes([])
            setEdges([])
            currentTableRef.current = null
            try {
                const rules = await getBusinessRulesForTable(tableName)
                if (rules.length === 0) {
                    setError(`No business rules found on table "${tableName}". Check the table name and try again.`)
                } else {
                    currentTableRef.current = { name: tableName, rules }
                    setSelectedRule(null)
                    setCollapsedGroupsTable(new Set(['group-before', 'group-after', 'group-async', 'group-display']))
                    saveTablePreference(tableName).then(() => getRecentTables().then(setRecentTables)).catch(() => {})
                }
            } catch (err: unknown) {
                setError(`Failed to load business rules: ${err instanceof Error ? err.message : String(err)}`)
            } finally {
                setLoading(false)
            }
        } else if (currentTableRef.current) {
            // Re-render
            const { name, rules } = currentTableRef.current
            const { nodes: n, edges: e } = buildFlowElements(name, rules, collapsedGroupsTable, handleToggleGroupTable, null)
            setNodes(n)
            setEdges(e)
        }
    }, [setNodes, setEdges, collapsedGroupsTable, handleToggleGroupTable])

    const handleVisualizeUser = useCallback(async (user: UserSuggestion, fetchNew = true) => {
        if (fetchNew) {
            setLoading(true)
            setError(null)
            setNodes([])
            setEdges([])
            currentUserRef.current = null
            try {
                const items = await getUserItems(user.value, user.user_name)
                currentUserRef.current = { user, items }
                saveUserPreference(user).then(() => getRecentUsers().then(setRecentUsers)).catch(() => {})
                const { nodes: n, edges: e } = buildUserFlowElements(user, items, collapsedGroupsUser, handleToggleGroupUser)
                setNodes(n)
                setEdges(e)
            } catch (err: unknown) {
                setError(`Failed to load user items: ${err instanceof Error ? err.message : String(err)}`)
            } finally {
                setLoading(false)
            }
        } else if (currentUserRef.current) {
            // Re-render
            const { nodes: n, edges: e } = buildUserFlowElements(
                currentUserRef.current.user, currentUserRef.current.items, collapsedGroupsUser, handleToggleGroupUser
            )
            setNodes(n)
            setEdges(e)
        }
    }, [setNodes, setEdges, collapsedGroupsUser, handleToggleGroupUser])

    const showEmpty = nodes.length === 0 && !loading && !error

    return (
        <AppShell
            header={{ height: viewMode === 'table' ? 90 : 130 }}
            padding="md"
            styles={{ main: { display: 'flex', flexDirection: 'column', height: viewMode === 'table' ? 'calc(100vh - 90px)' : 'calc(100vh - 130px)', overflow: 'hidden' } }}
        >
            <AppShell.Header>
                <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'center', borderBottom: '1px solid #e5e7eb' }}>
                    <SegmentedControl
                        value={viewMode}
                        onChange={(value) => setViewMode(value as 'table' | 'user')}
                        data={[
                            { label: 'Table Rules', value: 'table' },
                            { label: 'User Items', value: 'user' },
                        ]}
                    />
                </div>
                <div style={{ height: 90 }}>
                    {viewMode === 'table' ? (
                        <TableSelector
                            loading={loading}
                            error={error}
                            recentTables={recentTables}
                            onVisualize={handleVisualizeTable}
                            onDeleteRecentTable={handleDeleteRecentTable}
                            onDismissError={() => setError(null)}
                            hideInherited={hideInherited}
                            onToggleHideInherited={handleToggleHideInherited}
                            hideActive={hideActive}
                            onToggleHideActive={handleToggleHideActive}
                            hideInactive={hideInactive}
                            onToggleHideInactive={handleToggleHideInactive}
                            scriptSearchQuery={scriptSearchQuery}
                            onScriptSearchQueryChange={setScriptSearchQuery}
                        />
                    ) : (
                        <UserSelector
                            loading={loading}
                            error={error}
                            recentUsers={recentUsers}
                            onVisualize={handleVisualizeUser}
                            onDeleteRecentUser={handleDeleteRecentUser}
                            onDismissError={() => setError(null)}
                        />
                    )}
                </div>
            </AppShell.Header>

            <AppShell.Main>
                <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
                    {showEmpty && (
                        <Center style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
                            <Stack align="center" gap="xs">
                                <ThemeIcon size={64} radius="md" variant="light" color={viewMode === 'table' ? 'gray' : 'teal'}>
                                    {viewMode === 'table' ? <IconSettings size={40} /> : <IconUser size={40} />}
                                </ThemeIcon>
                                <Text size="xl" fw={600} c="dimmed">Ready to visualize</Text>
                                <Text c="dimmed">
                                    {viewMode === 'table' 
                                        ? 'Enter a ServiceNow table name above and click Visualize.'
                                        : 'Search for a ServiceNow user above and click Visualize.'}
                                </Text>
                            </Stack>
                        </Center>
                    )}
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        nodeTypes={nodeTypes}
                        onNodeClick={handleNodeClick}
                        onPaneClick={handlePanelClose}
                        fitView
                        fitViewOptions={{ padding: 0.2 }}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        elementsSelectable={true}
                        attributionPosition="bottom-left"
                        minZoom={0.2}
                        maxZoom={2}
                    >
                        <Background color="#e2e8f0" gap={24} />
                        <Controls />
                        <MiniMap
                            nodeColor={(node) => {
                                if (node.type === 'groupNode') {
                                    const phase = (node.data as GroupNodeData).phase
                                    return phase === 'before'  ? '#3b82f6'
                                        :  phase === 'after'   ? '#22c55e'
                                        :  phase === 'async'   ? '#f59e0b'
                                        :  phase === 'display' ? '#a855f7'
                                        :  '#94a3b8'
                                }
                                if (node.type === 'databaseNode') return '#475569'
                                if (node.type === 'sectionLabelNode') return 'transparent'
                                if (node.type === 'userItemNode') {
                                    return (node.data as any).type === 'assigned' ? '#86efac' : '#93c5fd'
                                }
                                return '#cbd5e1'
                            }}
                            maskColor="rgba(255,255,255,0.6)"
                        />
                    </ReactFlow>

                    {viewMode === 'table' && <DetailPanel rule={selectedRule} onClose={handlePanelClose} />}
                </div>
            </AppShell.Main>
        </AppShell>
    )
}
