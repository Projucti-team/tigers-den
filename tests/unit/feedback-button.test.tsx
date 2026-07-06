import { describe, it, expect, vi } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SessionProvider } from "next-auth/react";
import { FeedbackButton } from "@/components/FeedbackButton";

// Mock next-auth
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
  SessionProvider: ({ children }: any) => children,
}));

describe("FeedbackButton Component", () => {
  it("should render feedback button", () => {
    render(
      <SessionProvider session={null}>
        <FeedbackButton />
      </SessionProvider>,
    );

    const button = screen.getByRole("button", { name: /send feedback/i });
    expect(button).toBeInTheDocument();
  });

  it("should open modal when button clicked", async () => {
    render(
      <SessionProvider session={null}>
        <FeedbackButton />
      </SessionProvider>,
    );

    const button = screen.getByRole("button", { name: /send feedback/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Send Feedback")).toBeInTheDocument();
    });
  });

  it("should display form fields", async () => {
    render(
      <SessionProvider session={null}>
        <FeedbackButton />
      </SessionProvider>,
    );

    const button = screen.getByRole("button", { name: /send feedback/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Type")).toBeInTheDocument();
      expect(screen.getByText("Title *")).toBeInTheDocument();
      expect(screen.getByText("Description *")).toBeInTheDocument();
      expect(screen.getByText("Name *")).toBeInTheDocument();
      expect(screen.getByText("Email *")).toBeInTheDocument();
    });
  });

  it("should require title and description", async () => {
    render(
      <SessionProvider session={null}>
        <FeedbackButton />
      </SessionProvider>,
    );

    const button = screen.getByRole("button", { name: /send feedback/i });
    fireEvent.click(button);

    await waitFor(() => {
      const submitButton = screen.getByRole("button", {
        name: /submit feedback/i,
      });
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/please fill in title and description/i),
      ).toBeInTheDocument();
    });
  });

  it("should require email and name when not logged in", async () => {
    render(
      <SessionProvider session={null}>
        <FeedbackButton />
      </SessionProvider>,
    );

    const button = screen.getByRole("button", { name: /send feedback/i });
    fireEvent.click(button);

    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText(
        /brief summary of your feedback/i,
      );
      const descriptionInput = screen.getByPlaceholderText(
        /please provide as much detail as possible/i,
      );

      fireEvent.change(titleInput, { target: { value: "Test Title" } });
      fireEvent.change(descriptionInput, {
        target: { value: "Test Description" },
      });

      const submitButton = screen.getByRole("button", {
        name: /submit feedback/i,
      });
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/please provide email and name/i),
      ).toBeInTheDocument();
    });
  });

  it("should close modal on successful submission", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, id: 1 }),
      }),
    ) as any;

    render(
      <SessionProvider session={null}>
        <FeedbackButton />
      </SessionProvider>,
    );

    const button = screen.getByRole("button", { name: /send feedback/i });
    fireEvent.click(button);

    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText(
        /brief summary of your feedback/i,
      );
      const descriptionInput = screen.getByPlaceholderText(
        /please provide as much detail as possible/i,
      );
      const nameInput = screen.getByPlaceholderText(/your name/i);
      const emailInput = screen.getByPlaceholderText(/your@email.com/i);

      fireEvent.change(titleInput, { target: { value: "Test Title" } });
      fireEvent.change(descriptionInput, {
        target: { value: "Test Description" },
      });
      fireEvent.change(nameInput, { target: { value: "Test User" } });
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });

      const submitButton = screen.getByRole("button", {
        name: /submit feedback/i,
      });
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/thank you.*your feedback has been received/i),
      ).toBeInTheDocument();
    });
  });

  it("should display category options", async () => {
    render(
      <SessionProvider session={null}>
        <FeedbackButton />
      </SessionProvider>,
    );

    const button = screen.getByRole("button", { name: /send feedback/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByDisplayValue("bug")).toBeInTheDocument();
      expect(screen.getByText(/🐛 Bug Report/)).toBeInTheDocument();
      expect(screen.getByText(/✨ Feature Request/)).toBeInTheDocument();
      expect(screen.getByText(/💬 Other Feedback/)).toBeInTheDocument();
    });
  });

  it("should auto-fill user details when logged in", async () => {
    const mockSession = {
      user: {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
      },
    };

    vi.mocked(useSession).mockReturnValue({ data: mockSession } as any);

    render(
      <SessionProvider session={mockSession}>
        <FeedbackButton />
      </SessionProvider>,
    );

    const button = screen.getByRole("button", { name: /send feedback/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText(/submitting as john doe \(john@example.com\)/i),
      ).toBeInTheDocument();
    });
  });
});
