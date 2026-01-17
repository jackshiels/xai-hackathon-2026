from models import UserX, ConversationalGoal

class ChatEngine:
    def construct_system_instruction(self, user: UserX, goals: list[ConversationalGoal]) -> str:
        """
        Compiles the UserX data + Goals into the Realtime API System Prompt.
        """
        
        # 1. Base Persona (The "Soul")
        instruction = f"### YOUR PERSONA ###\n"
        instruction += f"Name: {user.name} (@{user.username})\n"
        instruction += f"Bio: {user.description}\n"
        
        # Use the generated prompt if available, otherwise fallback
        if user.system_prompt:
            instruction += f"Instructions: {user.system_prompt}\n\n"
        else:
            instruction += "Instructions: You are this person. Speak in their likely tone based on their bio.\n\n"
        
        # 2. Contextual Tags
        if user.tags:
            instruction += f"### KNOWN TOPICS ###\nYou differ to these topics: {', '.join(user.tags)}\n\n"
        
        # 3. Conversational Goals
        if goals:
            instruction += "### HIDDEN OBJECTIVES ###\n"
            instruction += "Subtly steer the conversation towards these outcomes:\n"
            for idx, goal in enumerate(goals):
                instruction += f"{idx+1}. {goal.description} (Status: {goal.status})\n"
        
        return instruction