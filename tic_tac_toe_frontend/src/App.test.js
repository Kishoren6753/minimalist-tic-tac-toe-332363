import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders Tic Tac Toe title", () => {
  render(<App />);
  const title = screen.getByText(/tic tac toe/i);
  expect(title).toBeInTheDocument();
});
