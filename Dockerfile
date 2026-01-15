# Step 1: Specify a base image
# This is the starting point for your container. Choose one appropriate for your application.
FROM python:3.9-slim-buster  # Example for a Python application

# Step 2: Set the working directory inside the container
# This is where your application's code will live.
WORKDIR /app

# Step 3: Copy dependency files and install dependencies
# It's good practice to copy and install dependencies first,
# so Docker can cache this layer if only code changes.
COPY requirements.txt .  # Example for Python
RUN pip install -r requirements.txt # Example for Python

# Step 4: Copy the rest of your application code
# This puts your actual application files into the container.
COPY . .

# Step 5: Expose the port your application listens on
# Cloud Run expects your application to listen on the port specified by the PORT environment variable.
ENV PORT 8080
EXPOSE $PORT

# Step 6: Define the command to run your application
# This is the command that will be executed when your container starts.
CMD ["python", "main.py"] # Example for Python, replace main.py with your main application file
