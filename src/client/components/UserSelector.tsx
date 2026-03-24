import React, { useState, useEffect, useRef } from 'react'
import { Autocomplete, Button, Group, Alert, Title, ActionIcon, Container, Menu, Tooltip, Stack, Text, Anchor } from '@mantine/core'
import { IconSettings, IconAlertCircle, IconSearch, IconHistory, IconTrash, IconUser } from '@tabler/icons-react'
import { searchUsers, UserSuggestion } from '../services/UserService'

interface UserSelectorProps {
    loading: boolean
    error: string | null
    recentUsers: UserSuggestion[]
    onVisualize: (user: UserSuggestion) => void
    onDeleteRecentUser: (userId: string) => void
    onDismissError: () => void
}

export default function UserSelector({
    loading,
    error,
    recentUsers,
    onVisualize,
    onDeleteRecentUser,
    onDismissError
}: UserSelectorProps) {
    const [inputValue, setInputValue] = useState('')
    const [suggestions, setSuggestions] = useState<UserSuggestion[]>([])
    const inputRef = useRef<HTMLInputElement>(null)

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    // Debounce search
    useEffect(() => {
        if (!inputValue.trim()) {
            setSuggestions([])
            return
        }
        let active = true
        const timer = setTimeout(() => {
            searchUsers(inputValue.trim())
                .then((res) => {
                    if (active) setSuggestions(res)
                })
                .catch(console.error)
        }, 300)
        return () => {
            active = false
            clearTimeout(timer)
        }
    }, [inputValue])

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const user = suggestions.find(s => s.label === inputValue)
        if (user) onVisualize(user)
    }

    function handleOptionSubmit(val: string) {
        setInputValue(val)
        const user = suggestions.find(s => s.label === val)
        if (user) onVisualize(user)
    }

    return (
        <Container fluid px="md" h="100%">
            <Group wrap="nowrap" align="center" w="100%" h="100%">
                {/* Left: Brand */}
                <Group gap="md" wrap="nowrap" style={{ flex: 1 }}>
                    <ActionIcon variant="light" radius="md" color="teal" aria-hidden="true" style={{ width: 54, height: 54 }}>
                        <IconUser size={32} />
                    </ActionIcon>
                    <Stack gap={2}>
                        <Title order={3} style={{ whiteSpace: 'nowrap', lineHeight: 1.1 }}>User Visualizer</Title>
                        <Text size="sm" c="dimmed" style={{ lineHeight: 1.2 }}>Visualize elements assigned to and created by a user</Text>
                        <Text size="xs" c="dimmed" fs="italic" style={{ lineHeight: 1.2 }}>
                            Created by <Anchor href="https://www.linkedin.com/in/danielaagrenmadsen/" target="_blank" fs="italic">Daniel Aagren Seehartrai Madsen</Anchor> • ServiceNow Rising Star 2025
                        </Text>
                    </Stack>
                </Group>

                {/* Center: Search Form & History */}
                <form onSubmit={handleSubmit} role="search" style={{ flex: 2, maxWidth: 500, margin: 0 }}>
                    <Group wrap="nowrap" gap="sm" align="center">
                        <Menu shadow="md" width={200} position="bottom-start">
                            <Menu.Target>
                                <Tooltip label="Recent users">
                                    <ActionIcon variant="default" style={{ width: 36, height: 36 }} aria-label="Recent users">
                                        <IconHistory size={20} />
                                    </ActionIcon>
                                </Tooltip>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Label>Recent Users</Menu.Label>
                                {recentUsers.length > 0 ? (
                                    recentUsers.map(u => (
                                        <Menu.Item
                                            key={u.value}
                                            onClick={() => {
                                                setInputValue(u.label)
                                                onVisualize(u)
                                            }}
                                            rightSection={
                                                <ActionIcon
                                                    size="xs"
                                                    variant="subtle"
                                                    color="gray"
                                                    aria-label={`Remove ${u.label} from history`}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onDeleteRecentUser(u.value)
                                                    }}
                                                >
                                                    <IconTrash size={12} />
                                                </ActionIcon>
                                            }
                                        >
                                            {u.label}
                                        </Menu.Item>
                                    ))
                                ) : (
                                    <Menu.Item disabled>No recent users</Menu.Item>
                                )}
                            </Menu.Dropdown>
                        </Menu>

                        <Autocomplete
                            ref={inputRef}
                            placeholder="Search user by name or username..."
                            data={suggestions.map(s => s.label)}
                            value={inputValue}
                            onChange={setInputValue}
                            onOptionSubmit={handleOptionSubmit}
                            disabled={loading}
                            aria-label="ServiceNow User"
                            autoComplete="off"
                            spellCheck={false}
                            style={{ flex: 1 }}
                            leftSection={<IconSearch size={16} />}
                            maxDropdownHeight={280}
                        />
                        <Button 
                            type="submit" 
                            color="teal"
                            loading={loading} 
                            disabled={!inputValue.trim()}
                            style={{ height: 36 }}
                        >
                            Visualize
                        </Button>
                    </Group>
                </form>

                {/* Right: Empty for spacing */}
                <Group gap="md" wrap="nowrap" justify="flex-end" style={{ flex: 1 }}></Group>
            </Group>

            {error && (
                <Alert 
                    icon={<IconAlertCircle size={16} />} 
                    title="Error" 
                    color="red" 
                    withCloseButton 
                    onClose={onDismissError}
                    variant="light"
                    style={{ position: 'absolute', top: 100, right: 20, zIndex: 1000, maxWidth: 400, boxShadow: 'var(--mantine-shadow-md)' }}
                >
                    {error}
                </Alert>
            )}
        </Container>
    )
}
